import { Response } from 'express';
import { AttachmentUrlDto, ERROR_CODES } from '@webchat/shared';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getServerContext } from '../context.js';
import { getPrisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

/**
 * `GET /api/attachments/:id/url`: a fresh signed URL, for whoever may see the Attachment now
 * (ADR 0009): a Direct Chat Participant or current Room Member of its message, or its uploader
 * while it is not sent yet. Anyone else gets the same `404` as for an id that does not exist.
 */
export async function getAttachmentUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { storage, config } = getServerContext(req);

  const attachment = await getPrisma().attachment.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { uploaderId: userId, directMessageId: null, roomMessageId: null },
        { directMessage: { directChat: { participants: { some: { userId } } } } },
        { roomMessage: { room: { members: { some: { userId } } } } },
      ],
    },
    select: { storageKey: true },
  });
  if (!attachment) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Attachment not found');
  }

  const signed = await storage.createSignedUrl(attachment.storageKey, config.timing.signedUrlTtlSeconds);
  const body: AttachmentUrlDto = { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  res.status(200).json(body);
}
