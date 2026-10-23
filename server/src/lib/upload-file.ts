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

function imageTooLarge(maxImagePixels: number): AppError {
  const megapixels = Math.floor(maxImagePixels / 1_000_000);
  return new AppError(413, ERROR_CODES.IMAGE_TOO_LARGE, `Image is too large: at most ${megapixels} megapixels`);
}

export interface PrepareUploadOptions {
  /** Largest width x height accepted for an image (`config.uploads.maxImagePixels`). */
  maxImagePixels: number;
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
async function stripImageMetadata(data: Buffer, format: 'jpeg' | 'png' | 'webp', maxImagePixels: number): Promise<Buffer> {
  return sharp(data, { limitInputPixels: maxImagePixels }).rotate().toFormat(format).toBuffer();
}

/**
 * Reads the image header only (nothing is decoded) and checks its declared size against the
 * limit, so a decompression bomb is refused before any pixel is allocated. Throws `415` when the
 * header cannot be read and `413 IMAGE_TOO_LARGE` when the image is over the limit.
 */
async function checkImageSize(data: Buffer, maxImagePixels: number): Promise<void> {
  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = await sharp(data).metadata());
  } catch {
    throw unsupportedFileType();
  }
  if (!width || !height) throw unsupportedFileType();
  if (width * height > maxImagePixels) throw imageTooLarge(maxImagePixels);
}

/**
 * Turns uploaded bytes into what gets stored: checks the real file type against the allowlist
 * (`415` otherwise), refuses images over the pixel limit (`413`) and strips image metadata. A
 * file that has an image signature but does not decode as that image is rejected too.
 */
export async function prepareUpload(data: Buffer, { maxImagePixels }: PrepareUploadOptions): Promise<PreparedUpload> {
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
    await checkImageSize(data, maxImagePixels);
    // GIF is kept byte for byte so animations survive; its header was read above.
    const format = REENCODED_FORMATS[detected.mimeType];
    if (format) {
      try {
        stored = await stripImageMetadata(data, format, maxImagePixels);
      } catch {
        throw unsupportedFileType();
      }
    }
  }

  return { data: stored, kind: detected.kind, mimeType: detected.mimeType };
}
