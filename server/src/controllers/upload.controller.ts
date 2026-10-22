import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getServerContext } from '../context.js';

export async function uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  const adapter = getServerContext(req).storage;
  const result = await adapter.upload(req.file);
  res.status(200).json(result);
}
