import { Response } from 'express';
import { ATTACHMENT_RULES, ERROR_CODES, UploadResponseDto, truncateCharacters } from '@webchat/shared';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getServerContext } from '../context.js';
import { getPrisma } from '../lib/prisma.js';
import { prepareUpload, PreparedUpload } from '../lib/upload-file.js';
import { AppError } from '../lib/errors.js';
import { logSecurityEvent } from '../lib/security-events.js';
import { toAttachmentDto } from '../lib/attachments.js';

export async function uploadFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file || !req.user) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  const { storage, config } = getServerContext(req);

  // Type, size and stored bytes all come from the server, never from what the client declared.
  let prepared: PreparedUpload;
  try {
    prepared = await prepareUpload(req.file.buffer, { maxImagePixels: config.uploads.maxImagePixels });
  } catch (err) {
    // An expected refusal (not an allowed file type, or an image too large); anything else is a 500.
    if (err instanceof AppError) {
      logSecurityEvent(req.log, 'upload.rejected', {
        reason: err.code === ERROR_CODES.IMAGE_TOO_LARGE ? 'image_too_large' : 'unsupported_type',
        declaredType: req.file.mimetype.slice(0, 100),
        size: req.file.size,
      });
    }
    throw err;
  }
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
  logSecurityEvent(req.log, 'upload.accepted', {
    attachmentId: attachment.id,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    size: attachment.size,
  });
  const body: UploadResponseDto = { attachment: toAttachmentDto(attachment, signed) };
  res.status(201).json(body);
}
