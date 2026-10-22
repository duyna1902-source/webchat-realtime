import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '@webchat/shared';
import { AppError } from '../lib/errors.js';

/** Largest file accepted by `POST /api/upload`. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

// Kept in memory: the file type is detected from the bytes and images are re-encoded before
// anything is stored, so nothing the client sent ever lands on disk as is.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
});

export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        next(
          err.code === 'LIMIT_FILE_SIZE'
            ? new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, 'File size exceeds 10MB limit')
            : new AppError(400, ERROR_CODES.BAD_REQUEST, 'Invalid upload request')
        );
        return;
      }
      // An unexpected failure (generic 500 via the error handler).
      next(err);
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    next();
  });
}
