import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '@webchat/shared';
import { UPLOADS_DIR, ensureUploadsDirExists, isAllowedMimeType } from '../lib/storage.js';
import { AppError } from '../lib/errors.js';

ensureUploadsDirExists();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDirExists();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, ERROR_CODES.BAD_REQUEST, 'Unsupported file type. Only standard images and documents are allowed.'));
    }
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
      // Our own file filter rejection, or an unexpected disk error (generic 500 via the error handler).
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
