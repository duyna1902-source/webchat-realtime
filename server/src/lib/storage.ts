import fs from 'fs';
import path from 'path';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { Router, type RequestHandler } from 'express';
import type { StorageConfig } from '../config.js';

// Local adapter directory (defaults to <cwd>/uploads)
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

export interface PutOptions {
  /** The `Content-Type` detected by the server, never the one the client declared. */
  contentType: string;
}

export interface StoredObject {
  /** Random UUID naming the object in storage; never derived from the original file name. */
  storageKey: string;
}

/** A URL that grants read access to one stored object until `expiresAt` (ADR 0009). */
export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

/** Milliseconds since the epoch; injectable so tests can move past an expiry. */
export type Clock = () => number;

// ==========================================
// CLOUD STORAGE ADAPTER PATTERN (ADR 0004, ADR 0009)
// ==========================================
// Objects are private. Nothing ever gets a permanent URL: readers get a signed URL with a TTL.

export interface StorageAdapter {
  readonly name: string;
  put(data: Buffer, options: PutOptions): Promise<StoredObject>;
  createSignedUrl(storageKey: string, ttlSeconds: number): Promise<SignedUrl>;
  /** Signs several keys at once. Keys that could not be signed are missing from the map. */
  createSignedUrls(storageKeys: readonly string[], ttlSeconds: number): Promise<Map<string, SignedUrl>>;
  /** Removes the object; removing a missing object is not an error. */
  delete(storageKey: string): Promise<void>;
  /** Every stored object key, e.g. to find objects no Attachment references. */
  list(): Promise<string[]>;
  /**
   * Only for adapters whose files this server serves itself (local): the handler mounted
   * at `/uploads`.
   */
  createRequestHandler?(): RequestHandler;
}

const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function expiryFrom(now: number, ttlSeconds: number): Date {
  return new Date(now + ttlSeconds * 1000);
}

/** Signs one key at a time; for adapters where batching saves nothing. */
async function signEach(
  adapter: Pick<StorageAdapter, 'createSignedUrl'>,
  storageKeys: readonly string[],
  ttlSeconds: number
): Promise<Map<string, SignedUrl>> {
  const signed = new Map<string, SignedUrl>();
  for (const key of new Set(storageKeys)) {
    signed.set(key, await adapter.createSignedUrl(key, ttlSeconds));
  }
  return signed;
}

export interface LocalStorageOptions {
  dir?: string;
  /** HMAC key for signed URLs. Defaults to a random key, so URLs die with the process. */
  signingSecret?: Buffer;
  now?: Clock;
}

// Dev and test only: the app is served from a single origin, so the URL is relative.
// Each object is `<dir>/<storageKey>`, with its content type in `<dir>/<storageKey>.json`.
// A signed URL is `/uploads/<storageKey>?expires=<ms>&signature=<HMAC of key and expiry>`.
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local';
  private readonly dir: string;
  private readonly signingSecret: Buffer;
  private readonly now: Clock;

  constructor(options: LocalStorageOptions | string = {}) {
    const opts = typeof options === 'string' ? { dir: options } : options;
    this.dir = opts.dir ?? UPLOADS_DIR;
    this.signingSecret = opts.signingSecret ?? randomBytes(32);
    this.now = opts.now ?? Date.now;
  }

  async put(data: Buffer, { contentType }: PutOptions): Promise<StoredObject> {
    const storageKey = randomUUID();
    await fs.promises.mkdir(this.dir, { recursive: true });
    await fs.promises.writeFile(path.join(this.dir, storageKey), data);
    await fs.promises.writeFile(path.join(this.dir, `${storageKey}.json`), JSON.stringify({ contentType }));
    return { storageKey };
  }

  async createSignedUrl(storageKey: string, ttlSeconds: number): Promise<SignedUrl> {
    const expiresAt = expiryFrom(this.now(), ttlSeconds);
    const expires = String(expiresAt.getTime());
    const signature = this.sign(storageKey, expires);
    return { url: `/uploads/${storageKey}?expires=${expires}&signature=${signature}`, expiresAt };
  }

  createSignedUrls(storageKeys: readonly string[], ttlSeconds: number): Promise<Map<string, SignedUrl>> {
    return signEach(this, storageKeys, ttlSeconds);
  }

  async delete(storageKey: string): Promise<void> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) return;
    await fs.promises.rm(path.join(this.dir, storageKey), { force: true });
    await fs.promises.rm(path.join(this.dir, `${storageKey}.json`), { force: true });
  }

  async list(): Promise<string[]> {
    try {
      return (await fs.promises.readdir(this.dir)).filter((name) => STORAGE_KEY_PATTERN.test(name));
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }

  private sign(storageKey: string, expires: string): string {
    return createHmac('sha256', this.signingSecret).update(`${storageKey}.${expires}`).digest('base64url');
  }

  private hasValidSignature(storageKey: string, expires: unknown, signature: unknown): boolean {
    if (typeof expires !== 'string' || typeof signature !== 'string' || !/^\d+$/.test(expires)) return false;
    const expected = Buffer.from(this.sign(storageKey, expires));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
    return this.now() < Number(expires);
  }

  /**
   * Serves stored files as downloads with their stored type and `nosniff`, so the browser
   * never renders one as a page of this origin. Only a valid, unexpired signed URL gets the file.
   */
  createRequestHandler(): RequestHandler {
    const router = Router();
    router.get('/:storageKey', async (req, res, next) => {
      const { storageKey } = req.params;
      if (!STORAGE_KEY_PATTERN.test(storageKey) || !this.hasValidSignature(storageKey, req.query.expires, req.query.signature)) {
        next();
        return;
      }
      try {
        const meta = JSON.parse(await fs.promises.readFile(path.join(this.dir, `${storageKey}.json`), 'utf8'));
        const data = await fs.promises.readFile(path.join(this.dir, storageKey));
        res.set({
          'Content-Type': meta.contentType,
          'Content-Disposition': 'attachment',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        });
        res.send(data);
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          next();
          return;
        }
        next(err);
      }
    });
    return router;
  }
}

const MEMORY_URL_PREFIX = 'memory://';

export interface MemoryObject {
  data: Buffer;
  contentType: string;
}

export interface InMemoryStorageOptions {
  now?: Clock;
}

// Test only: keeps uploaded bytes in process memory. A signed URL is
// `memory://<storageKey>?expires=<ms>` and reads back only until it expires.
export class InMemoryStorageAdapter implements StorageAdapter {
  readonly name = 'memory';
  private readonly objects = new Map<string, MemoryObject>();
  private readonly now: Clock;

  constructor(options: InMemoryStorageOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  async put(data: Buffer, { contentType }: PutOptions): Promise<StoredObject> {
    const storageKey = randomUUID();
    this.objects.set(storageKey, { data, contentType });
    return { storageKey };
  }

  async createSignedUrl(storageKey: string, ttlSeconds: number): Promise<SignedUrl> {
    const expiresAt = expiryFrom(this.now(), ttlSeconds);
    return { url: `${MEMORY_URL_PREFIX}${storageKey}?expires=${expiresAt.getTime()}`, expiresAt };
  }

  createSignedUrls(storageKeys: readonly string[], ttlSeconds: number): Promise<Map<string, SignedUrl>> {
    return signEach(this, storageKeys, ttlSeconds);
  }

  async delete(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }

  async list(): Promise<string[]> {
    return [...this.objects.keys()];
  }

  /** The stored object, addressed by its key (bypasses signing). */
  getObject(storageKey: string): MemoryObject | undefined {
    return this.objects.get(storageKey);
  }

  /** The stored object for a signed URL, as a browser would get it: nothing once it expired. */
  readObject(url: string): MemoryObject | undefined {
    if (!url.startsWith(MEMORY_URL_PREFIX)) return undefined;
    const [storageKey, query = ''] = url.slice(MEMORY_URL_PREFIX.length).split('?');
    const expires = Number(new URLSearchParams(query).get('expires'));
    if (!Number.isFinite(expires) || this.now() >= expires) return undefined;
    return this.objects.get(storageKey);
  }

  /** The stored bytes for a signed URL, if it is still valid. */
  read(url: string): Buffer | undefined {
    return this.readObject(url)?.data;
  }
}

export interface SupabaseStorageOptions {
  url: string;
  /** A Supabase secret key (`sb_secret_...`), never a legacy JWT-based `service_role` key. */
  secretKey: string;
  bucket: string;
  /** HTTP client; injectable so tests never reach the real Supabase. */
  fetch?: typeof fetch;
  now?: Clock;
}

/** Page size of the Storage list API. */
const SUPABASE_LIST_PAGE_SIZE = 1000;

// Private bucket: objects are read only through the Storage API's signed URLs.
export class SupabaseStorageAdapter implements StorageAdapter {
  readonly name = 'supabase';
  private supabaseUrl: string;
  private secretKey: string;
  private bucket: string;
  private fetch: typeof fetch;
  private now: Clock;

  constructor(options: SupabaseStorageOptions) {
    this.supabaseUrl = options.url.replace(/\/$/, '');
    this.secretKey = options.secretKey;
    this.bucket = options.bucket;
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? Date.now;
  }

  async put(data: Buffer, { contentType }: PutOptions): Promise<StoredObject> {
    const storageKey = randomUUID();
    const res = await this.request('POST', `/object/${this.bucket}/${storageKey}`, {
      body: data,
      contentType,
    });
    await this.ensureOk(res, 'upload');
    return { storageKey };
  }

  async createSignedUrl(storageKey: string, ttlSeconds: number): Promise<SignedUrl> {
    const expiresAt = expiryFrom(this.now(), ttlSeconds);
    const res = await this.request('POST', `/object/sign/${this.bucket}/${storageKey}`, {
      json: { expiresIn: this.expiresIn(ttlSeconds) },
    });
    await this.ensureOk(res, 'sign');
    const body = (await res.json()) as { signedURL?: unknown };
    if (typeof body.signedURL !== 'string') throw new Error('Supabase storage sign returned no URL');
    return { url: this.absoluteUrl(body.signedURL), expiresAt };
  }

  async createSignedUrls(storageKeys: readonly string[], ttlSeconds: number): Promise<Map<string, SignedUrl>> {
    const signed = new Map<string, SignedUrl>();
    const paths = [...new Set(storageKeys)];
    if (paths.length === 0) return signed;

    const expiresAt = expiryFrom(this.now(), ttlSeconds);
    const res = await this.request('POST', `/object/sign/${this.bucket}`, {
      json: { expiresIn: this.expiresIn(ttlSeconds), paths },
    });
    await this.ensureOk(res, 'sign');
    const items = (await res.json()) as { path?: unknown; signedURL?: unknown; error?: unknown }[];
    for (const item of Array.isArray(items) ? items : []) {
      if (typeof item.path === 'string' && typeof item.signedURL === 'string' && !item.error) {
        signed.set(item.path, { url: this.absoluteUrl(item.signedURL), expiresAt });
      }
    }
    return signed;
  }

  async delete(storageKey: string): Promise<void> {
    const res = await this.request('DELETE', `/object/${this.bucket}`, { json: { prefixes: [storageKey] } });
    await this.ensureOk(res, 'delete');
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (let offset = 0; ; offset += SUPABASE_LIST_PAGE_SIZE) {
      const res = await this.request('POST', `/object/list/${this.bucket}`, {
        json: { prefix: '', limit: SUPABASE_LIST_PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } },
      });
      await this.ensureOk(res, 'list');
      const page = (await res.json()) as { name?: unknown; id?: unknown }[];
      // Folders come back with a null id; objects at the bucket root have one.
      keys.push(...page.filter((o) => typeof o.name === 'string' && o.id != null).map((o) => o.name as string));
      if (page.length < SUPABASE_LIST_PAGE_SIZE) return keys;
    }
  }

  private request(
    method: string,
    apiPath: string,
    { body, contentType, json }: { body?: Buffer; contentType?: string; json?: unknown }
  ): Promise<Response> {
    if (!this.supabaseUrl || !this.secretKey) {
      throw new Error('Supabase storage is not configured');
    }
    // Secret keys are not JWTs: Supabase accepts them only in the `apikey` header,
    // and rejects them as a `Bearer` token.
    return this.fetch(`${this.supabaseUrl}/storage/v1${apiPath}`, {
      method,
      headers: {
        apikey: this.secretKey,
        'Content-Type': json !== undefined ? 'application/json' : (contentType ?? 'application/octet-stream'),
      },
      body: json !== undefined ? JSON.stringify(json) : body,
    });
  }

  private async ensureOk(res: Response, operation: string): Promise<void> {
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase storage ${operation} failed: ${errText}`);
    }
  }

  /** Supabase takes whole seconds. */
  private expiresIn(ttlSeconds: number): number {
    return Math.max(1, Math.ceil(ttlSeconds));
  }

  /** The API answers `/object/sign/<bucket>/<key>?token=...`, relative to `/storage/v1`. */
  private absoluteUrl(signedUrl: string): string {
    if (/^https?:\/\//.test(signedUrl)) return signedUrl;
    return `${this.supabaseUrl}/storage/v1${signedUrl.startsWith('/') ? '' : '/'}${signedUrl}`;
  }
}

/** Builds the real storage adapter selected by the validated configuration. */
export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.provider) {
    case 'supabase':
      return new SupabaseStorageAdapter(config);
    case 'local':
      return new LocalStorageAdapter();
  }
}
