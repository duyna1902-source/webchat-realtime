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
