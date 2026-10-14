import fs from 'fs';
import path from 'path';

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

export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local';

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    const filename = file.filename || file.originalname;
    const publicUrl = process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL.replace(/\/$/, '')}/uploads/${filename}`
      : `/uploads/${filename}`;

    return {
      url: publicUrl,
      name: file.originalname,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}

export class CloudinaryStorageAdapter implements StorageAdapter {
  readonly name = 'cloudinary';
  private cloudName: string;
  private uploadPreset?: string;
  private apiKey?: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    this.apiKey = process.env.CLOUDINARY_API_KEY;
  }

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    if (!this.cloudName) {
      throw new Error('CLOUDINARY_CLOUD_NAME is not configured');
    }

    let fileBuffer: Buffer;
    if (file.buffer) {
      fileBuffer = file.buffer;
    } else if (file.path && fs.existsSync(file.path)) {
      fileBuffer = await fs.promises.readFile(file.path);
    } else {
      throw new Error('File data is missing');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    if (this.uploadPreset) {
      formData.append('upload_preset', this.uploadPreset);
    }
    if (this.apiKey) {
      formData.append('api_key', this.apiKey);
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudinary upload failed: ${errText}`);
    }

    const data: any = await response.json();
    return {
      url: data.secure_url || data.url,
      name: file.originalname,
      filename: data.public_id || file.originalname,
      size: data.bytes || file.size,
      mimeType: file.mimetype,
    };
  }
}

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly name = 'supabase';
  private supabaseUrl: string;
  private serviceKey: string;
  private bucket: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'attachments';
  }

  async upload(file: Express.Multer.File): Promise<UploadResult> {
    if (!this.supabaseUrl || !this.serviceKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
    }

    let fileBuffer: Buffer;
    if (file.buffer) {
      fileBuffer = file.buffer;
    } else if (file.path && fs.existsSync(file.path)) {
      fileBuffer = await fs.promises.readFile(file.path);
    } else {
      throw new Error('File data is missing');
    }

    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitized}`;
    const cleanUrl = this.supabaseUrl.replace(/\/$/, '');
    const uploadUrl = `${cleanUrl}/storage/v1/object/${this.bucket}/${objectPath}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
        'Content-Type': file.mimetype,
      },
      body: fileBuffer,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase storage upload failed: ${errText}`);
    }

    const publicUrl = `${cleanUrl}/storage/v1/object/public/${this.bucket}/${objectPath}`;

    return {
      url: publicUrl,
      name: file.originalname,
      filename: objectPath,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}

export function getStorageAdapter(): StorageAdapter {
  const provider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (provider === 'cloudinary') {
    return new CloudinaryStorageAdapter();
  }
  if (provider === 'supabase') {
    return new SupabaseStorageAdapter();
  }
  return new LocalStorageAdapter();
}
