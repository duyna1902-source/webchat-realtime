import { ERROR_CODES } from '@webchat/shared';

export const UPLOAD_TYPE_NOT_ALLOWED_TEXT =
  "This file type isn't allowed. You can send images (JPEG, PNG, GIF, WebP), PDF, Word, Excel, PowerPoint or text files (TXT, CSV, MD, JSON).";

export const UPLOAD_TOO_LARGE_TEXT = 'File size exceeds 10MB limit. Please choose a smaller file.';

/** The message to show the user for a failed `POST /api/upload` response. */
export async function describeUploadError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  if (res.status === 415 || data.code === ERROR_CODES.UNSUPPORTED_FILE_TYPE) {
    return UPLOAD_TYPE_NOT_ALLOWED_TEXT;
  }
  if (res.status === 413) {
    return UPLOAD_TOO_LARGE_TEXT;
  }
  return data.message || 'File upload failed';
}
