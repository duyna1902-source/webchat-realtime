import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
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
  url: string;
}

// ==========================================
// CLOUD STORAGE ADAPTER PATTERN (ADR 0004)
// ==========================================

export interface StorageAdapter {
  readonly name: string;
  put(data: Buffer, options: PutOptions): Promise<StoredObject>;
  /**
   * Only for adapters whose files this server serves itself (local): the handler mounted
   * at `/uploads`.
   */
  createRequestHandler?(): RequestHandler;
}

const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Dev and test only: the app is served from a single origin, so the URL is relative.
// Each object is `<dir>/<storageKey>`, with its content type in `<dir>/<storageKey>.json`.
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local';

  constructor(private readonly dir: string = UPLOADS_DIR) {}

  async put(data: Buffer, { contentType }: PutOptions): Promise<StoredObject> {
    const storageKey = randomUUID();
    await fs.promises.mkdir(this.dir, { recursive: true });
    await fs.promises.writeFile(path.join(this.dir, storageKey), data);
    await fs.promises.writeFile(path.join(this.dir, `${storageKey}.json`), JSON.stringify({ contentType }));
    return { storageKey, url: `/uploads/${storageKey}` };
  }

  /**
   * Serves stored files as downloads with their stored type and `nosniff`, so the browser
   * never renders one as a page of this origin.
   */
  createRequestHandler(): RequestHandler {
    const router = Router();
    router.get('/:storageKey', async (req, res, next) => {
      const { storageKey } = req.params;
      if (!STORAGE_KEY_PATTERN.test(storageKey)) {
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

// Test only: keeps uploaded bytes in process memory, addressed by the returned URL.
export class InMemoryStorageAdapter implements StorageAdapter {
  readonly name = 'memory';
  private readonly objects = new Map<string, MemoryObject>();

  async put(data: Buffer, { contentType }: PutOptions): Promise<StoredObject> {
    const storageKey = randomUUID();
    this.objects.set(storageKey, { data, contentType });
    return { storageKey, url: `${MEMORY_URL_PREFIX}${storageKey}` };
  }

  /** Returns the stored object for a URL returned by `put`, if any. */
  readObject(url: string): MemoryObject | undefined {
    if (!url.startsWith(MEMORY_URL_PREFIX)) return undefined;
    return this.objects.get(url.slice(MEMORY_URL_PREFIX.length));
  }

  /** Returns the stored bytes for a URL returned by `put`, if any. */
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
}

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly name = 'supabase';
  private supabaseUrl: string;
  private secretKey: string;
  private bucket: string;
  private fetch: typeof fetch;

  constructor(options: SupabaseStorageOptions) {
    this.supabaseUrl = options.url.replace(/\/$/, '');
    this.secretKey = options.secretKey;
    this.bucket = options.bucket;
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async put(data: Buffer, { contentType }: PutOptions): Promise<StoredObject> {
    if (!this.supabaseUrl || !this.secretKey) {
      throw new Error('Supabase storage is not configured');
    }

    const storageKey = randomUUID();
    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${storageKey}`;

    // Secret keys are not JWTs: Supabase accepts them only in the `apikey` header,
    // and rejects them as a `Bearer` token.
    const res = await this.fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: this.secretKey,
        'Content-Type': contentType,
      },
      body: data,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase storage upload failed: ${errText}`);
    }

    return {
      storageKey,
      url: `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${storageKey}`,
    };
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
