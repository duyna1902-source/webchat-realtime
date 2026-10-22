import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { StorageConfig } from '../config.js';

// Upload directory resolution (defaults to <cwd>/uploads)
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

export function ensureUploadsDirExists(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export interface UploadResult {
  url: string;
  name: string;
  filename: string;
  size: number;
  mimeType: string;
}

/**
 * Validates whether the given MIME type is an allowed image or document.
 */
export function isAllowedMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  const mime = mimeType.toLowerCase();

  // Images: any image/*
  if (mime.startsWith('image/')) {
    return true;
  }

  // Common documents
  const allowedDocMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/xml',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'application/json',
    'application/xml',
    'application/rtf',
    'application/octet-stream',
  ];

  return allowedDocMimes.includes(mime);
}

// ==========================================
// CLOUD STORAGE ADAPTER PATTERN (ADR 0004)
// ==========================================

export interface StorageAdapter {
  readonly name: string;
  upload(file: Express.Multer.File): Promise<UploadResult>;
}

async function readUploadedFile(file: Express.Multer.File): Promise<Buffer> {
  if (file.buffer) {
    return file.buffer;
  }
  if (file.path && fs.existsSync(file.path)) {
    return fs.promises.readFile(file.path);
  }
  throw new Error('File data is missing');
}

async function removeTemporaryFile(file: Express.Multer.File): Promise<void> {
  if (file.path && fs.existsSync(file.path)) {
    await fs.promises.unlink(file.path).catch(() => {});
  }
}

// Dev and test only: the app is served from a single origin, so the URL is relative.
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local';

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    const filename = file.filename || file.originalname;

    return {
      url: `/uploads/${filename}`,
      name: file.originalname,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}

const MEMORY_URL_PREFIX = 'memory://';

// Test only: keeps uploaded bytes in process memory, addressed by the returned URL.
export class InMemoryStorageAdapter implements StorageAdapter {
  readonly name = 'memory';
  private readonly objects = new Map<string, Buffer>();

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    try {
      const data = await readUploadedFile(file);
      const key = randomUUID();
      this.objects.set(key, data);

      return {
        url: `${MEMORY_URL_PREFIX}${key}`,
        name: file.originalname,
        filename: key,
        size: data.length,
        mimeType: file.mimetype,
      };
    } finally {
      await removeTemporaryFile(file);
    }
  }

  /** Returns the stored bytes for a URL returned by `upload`, if any. */
  read(url: string): Buffer | undefined {
    if (!url.startsWith(MEMORY_URL_PREFIX)) return undefined;
    return this.objects.get(url.slice(MEMORY_URL_PREFIX.length));
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

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    if (!this.supabaseUrl || !this.secretKey) {
      throw new Error('Supabase storage is not configured');
    }

    try {
      const fileBuffer = await readUploadedFile(file);

      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitized}`;
      const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${objectPath}`;

      // Secret keys are not JWTs: Supabase accepts them only in the `apikey` header,
      // and rejects them as a `Bearer` token.
      const res = await this.fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: this.secretKey,
          'Content-Type': file.mimetype,
        },
        body: fileBuffer,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Supabase storage upload failed: ${errText}`);
      }

      const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucket}/${objectPath}`;

      return {
        url: publicUrl,
        name: file.originalname,
        filename: objectPath,
        size: file.size,
        mimeType: file.mimetype,
      };
    } finally {
      await removeTemporaryFile(file);
    }
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
