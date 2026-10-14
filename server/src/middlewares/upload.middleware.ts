import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { UPLOADS_DIR, ensureUploadsDirExists, isAllowedMimeType } from '../lib/storage.js';

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
      cb(new Error('Unsupported file type. Only standard images and documents are allowed.'));
    }
  },
});

export function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ message: 'File size exceeds 10MB limit' });
          return;
        }
        res.status(400).json({ message: err.message });
        return;
      }
      res.status(400).json({ message: err.message || 'File upload failed' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    next();
  });
}
