import { Response } from 'express';
import { ATTACHMENT_RULES, UploadResponseDto, truncateCharacters } from '@webchat/shared';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getServerContext } from '../context.js';
import { getPrisma } from '../lib/prisma.js';
import { prepareUpload } from '../lib/upload-file.js';
import { toAttachmentDto } from '../lib/attachments.js';

export async function uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file || !req.user) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  const { storage, config } = getServerContext(req);

  // Type, size and stored bytes all come from the server, never from what the client declared.
  const prepared = await prepareUpload(req.file.buffer);
  const { storageKey } = await storage.put(prepared.data, { contentType: prepared.mimeType });

  const attachment = await getPrisma().attachment.create({
    data: {
      uploaderId: req.user.userId,
      storageKey,
      kind: prepared.kind,
      mimeType: prepared.mimeType,
      size: prepared.data.length,
      originalName: truncateCharacters(req.file.originalname, ATTACHMENT_RULES.NAME_MAX_LENGTH),
    },
  });

  // Signed for the uploader's own preview; recipients get theirs with the message.
  const signed = await storage.createSignedUrl(storageKey, config.timing.signedUrlTtlSeconds);
  const body: UploadResponseDto = { attachment: toAttachmentDto(attachment, signed) };
  res.status(201).json(body);
}
