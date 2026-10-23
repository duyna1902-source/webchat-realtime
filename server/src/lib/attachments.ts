import type { Attachment, Prisma } from '@prisma/client';
import { AttachmentDto, AttachmentKind, ERROR_CODES, MessageType } from '@webchat/shared';
import type { StorageAdapter, SignedUrl } from './storage.js';
import { AppError } from './errors.js';

// ==========================================
// ATTACHMENT RECORDS AND SIGNED URLS (ADR 0009)
// ==========================================
// Every upload is a server-owned Attachment row. A message carries an Attachment by reference
// only; its file name, size and type, and the message type, come from that row. Files are read
// through signed URLs, issued with a TTL each time a message is handed to a client.

/** What signing needs: the storage adapter and the TTL from the configuration. */
export interface AttachmentSigner {
  storage: StorageAdapter;
  ttlSeconds: number;
}

/** An Attachment row as included with a message (or `null`/`undefined` when it has none). */
export type AttachmentRecord = Pick<Attachment, 'id' | 'storageKey' | 'kind' | 'mimeType' | 'size' | 'originalName'>;

/** Signed Attachments of a batch of messages, by Attachment id. */
export type SignedAttachments = ReadonlyMap<string, AttachmentDto>;

export const NO_ATTACHMENTS: SignedAttachments = new Map();

export function toAttachmentDto(record: AttachmentRecord, signed: SignedUrl): AttachmentDto {
  return {
    id: record.id,
    kind: record.kind as AttachmentKind,
    mimeType: record.mimeType,
    size: record.size,
    name: record.originalName,
    url: signed.url,
    urlExpiresAt: signed.expiresAt.toISOString(),
  };
}

/**
 * Signs every Attachment among `records` in one storage call. An Attachment whose object could
 * not be signed is left out, so its message is handed out without it.
 */
export async function signAttachments(
  signer: AttachmentSigner,
  records: readonly (AttachmentRecord | null | undefined)[]
): Promise<SignedAttachments> {
  const present = records.filter((r): r is AttachmentRecord => Boolean(r));
  if (present.length === 0) return NO_ATTACHMENTS;

  const urls = await signer.storage.createSignedUrls(
    present.map((r) => r.storageKey),
    signer.ttlSeconds
  );
  const signed = new Map<string, AttachmentDto>();
  for (const record of present) {
    const url = urls.get(record.storageKey);
    if (url) signed.set(record.id, toAttachmentDto(record, url));
  }
  return signed;
}

/** The DTO for a message's Attachment, from a batch signed with `signAttachments`. */
export function attachmentOf(
  message: { attachment?: AttachmentRecord | null },
  signed: SignedAttachments
): AttachmentDto | null {
  return message.attachment ? (signed.get(message.attachment.id) ?? null) : null;
}

/**
 * True when the message should show "attachment no longer available": the data upgrade removed
 * its legacy attachment or GIF, or it is an image or document message without a readable
 * Attachment (e.g. its object could not be signed).
 */
export function isAttachmentUnavailable(
  message: { type: string; attachmentUnavailable?: boolean | null },
  attachment: AttachmentDto | null
): boolean {
  if (message.attachmentUnavailable) return true;
  return !attachment && (message.type === MessageType.IMAGE || message.type === MessageType.DOCUMENT);
}

/** Message type of a message carrying an Attachment of this kind. */
export function messageTypeFor(kind: AttachmentKind | string): MessageType {
  return kind === AttachmentKind.IMAGE ? MessageType.IMAGE : MessageType.DOCUMENT;
}

function attachmentInvalid(): AppError {
  return new AppError(400, ERROR_CODES.ATTACHMENT_INVALID, 'Attachment not found or already sent');
}

/** Columns of an unsent Attachment uploaded by `uploaderId`; anything else is not sendable. */
function sendableBy(attachmentId: string, uploaderId: string): Prisma.AttachmentWhereInput {
  return { id: attachmentId, uploaderId, directMessageId: null, roomMessageId: null };
}

/**
 * The Attachment `uploaderId` wants to send: it must exist, be theirs and not be linked to any
 * message yet. Otherwise throws `ATTACHMENT_INVALID`.
 */
export async function findSendableAttachment(
  db: Prisma.TransactionClient,
  attachmentId: string,
  uploaderId: string
): Promise<Attachment> {
  const attachment = await db.attachment.findFirst({ where: sendableBy(attachmentId, uploaderId) });
  if (!attachment) throw attachmentInvalid();
  return attachment;
}

/**
 * Links the Attachment to the message just created in the same transaction. The update is
 * conditional, so of two concurrent sends of one Attachment only one wins; the other throws
 * `ATTACHMENT_INVALID` and its transaction (with its message) rolls back.
 */
export async function linkAttachment(
  db: Prisma.TransactionClient,
  attachmentId: string,
  uploaderId: string,
  link: { directMessageId: string } | { roomMessageId: string }
): Promise<void> {
  const { count } = await db.attachment.updateMany({ where: sendableBy(attachmentId, uploaderId), data: link });
  if (count !== 1) throw attachmentInvalid();
}
