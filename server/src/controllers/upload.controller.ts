import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { UploadResponseDto } from '@webchat/shared';

export async function uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const response: UploadResponseDto & { filename: string } = {
    url: fileUrl,
    name: req.file.originalname,
    filename: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
  };

  res.status(200).json(response);
}
