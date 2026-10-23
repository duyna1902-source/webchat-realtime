import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getServerContext } from '../context.js';
import { prepareUpload } from '../lib/upload-file.js';

export async function uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  // Type, size and stored bytes all come from the server, never from what the client declared.
  const prepared = await prepareUpload(req.file.buffer);
  const stored = await getServerContext(req).storage.put(prepared.data, { contentType: prepared.mimeType });

  res.status(200).json({
    url: stored.url,
    name: req.file.originalname,
    size: prepared.data.length,
    mimeType: prepared.mimeType,
  });
}
