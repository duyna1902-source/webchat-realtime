import sharp from 'sharp';
import { ERROR_CODES } from '@webchat/shared';
import { AppError } from './errors.js';
import { detectFileType, AttachmentKind } from './file-type-detect.js';

export interface PreparedUpload {
  /** The bytes to store: re-encoded without metadata for JPEG, PNG and WebP, untouched otherwise. */
  data: Buffer;
  kind: AttachmentKind;
  mimeType: string;
}

export const UNSUPPORTED_FILE_TYPE_MESSAGE =
  'This file type is not allowed. Upload an image (JPEG, PNG, GIF, WebP), a PDF, an Office document or a text file (TXT, CSV, MD, JSON).';

function unsupportedFileType(): AppError {
  return new AppError(415, ERROR_CODES.UNSUPPORTED_FILE_TYPE, UNSUPPORTED_FILE_TYPE_MESSAGE);
}

const REENCODED_FORMATS: Record<string, 'jpeg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Re-encodes the image: turned upright per its EXIF orientation first, then written out
 * without any metadata (sharp drops EXIF, ICC, XMP... unless asked to keep them).
 */
async function stripImageMetadata(data: Buffer, format: 'jpeg' | 'png' | 'webp'): Promise<Buffer> {
  return sharp(data).rotate().toFormat(format).toBuffer();
}

/**
 * Turns uploaded bytes into what gets stored: checks the real file type against the allowlist
 * (`415` otherwise) and strips image metadata. A file that has an image signature but does not
 * decode as that image is rejected too.
 */
export async function prepareUpload(data: Buffer): Promise<PreparedUpload> {
  let detected: ReturnType<typeof detectFileType>;
  try {
    detected = detectFileType(data);
  } catch {
    // A malformed container (truncated ZIP or OLE structures) is simply not an allowed file.
    detected = null;
  }
  if (!detected) {
    throw unsupportedFileType();
  }

  let stored = data;
  if (detected.kind === 'IMAGE') {
    const format = REENCODED_FORMATS[detected.mimeType];
    try {
      if (format) {
        stored = await stripImageMetadata(data, format);
      } else {
        // GIF is kept byte for byte so animations survive; it only has to decode.
        await sharp(data).metadata();
      }
    } catch {
      throw unsupportedFileType();
    }
  }

  return { data: stored, kind: detected.kind, mimeType: detected.mimeType };
}
