import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getStorageAdapter } from '../lib/storage.js';

export async function uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const adapter = getStorageAdapter();
    const result = await adapter.upload(req.file);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error during file upload:', err);
    res.status(500).json({ message: err.message || 'File upload failed' });
  }
}
