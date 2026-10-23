import { ATTACHMENT_RULES, MessageType, isAllowedGifUrl, truncateCharacters } from '@webchat/shared';
import type { StorageConfig } from '../config.js';
import { hasLegacyColumn } from './legacy-columns.js';
import type { UpgradeStep, UpgradeStepContext } from './runner.js';

// ==========================================
// LEGACY ATTACHMENTS (ticket 14, ADR 0009)
// ==========================================
// Before ADR 0009 a message stored a public URL (plus name and size) that the client declared.
// A URL pointing at an object of the project bucket becomes an Attachment record. Any other URL
// (`javascript:`, a foreign domain, empty) is removed and the message is marked
// `attachmentUnavailable`, keeping its text. Finally every bucket object no Attachment references
// is deleted: it may have been planted by someone holding the leaked key.

type Db = UpgradeStepContext['db'];

const UNKNOWN_MIME_TYPE = 'application/octet-stream';
const KEY_PREVIEW_LENGTH = 120;

/**
 * Prefix of the public object URLs the legacy Supabase adapter handed out:
 * `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`. Null without Supabase storage, in which
 * case no legacy URL counts as belonging to the bucket.
 */
export function legacyBucketUrl(storage: StorageConfig): string | null {
  if (storage.provider !== 'supabase') return null;
  return `${storage.url.replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`;
}

/** The storage key a legacy URL points at, or null when it is not an object of the bucket. */
export function storageKeyOfLegacyUrl(url: string, bucketUrl: string | null): string | null {
  if (!bucketUrl || !url.startsWith(bucketUrl)) return null;
  const rest = url.slice(bucketUrl.length);
  if (rest === '' || /[?#]/.test(rest)) return null;
  const segments: string[] = [];
  for (const raw of rest.split('/')) {
    let segment: string;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (segment === '' || segment === '.' || segment === '..' || segment.includes('/')) return null;
    segments.push(segment);
  }
  return segments.join('/');
}

function show(value: string): string {
  if (value.length <= KEY_PREVIEW_LENGTH) return JSON.stringify(value);
  return `${JSON.stringify(value.slice(0, KEY_PREVIEW_LENGTH))}… (${value.length} chars)`;
}

interface LegacyMessage {
  id: string;
  senderId: string;
  type: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
}

// The legacy columns are no longer in the Prisma schema (the contract migration drops them), so
// they are read and cleared with raw SQL, and only while they still exist.
interface MessageTable {
  label: 'DirectMessage' | 'RoomMessage';
  withLegacyAttachment(db: Db): Promise<LegacyMessage[]>;
  /** Clears the legacy columns, and marks the message unavailable when its attachment was removed. */
  clearLegacy(db: Db, id: string, unavailable: boolean): Promise<unknown>;
  link(id: string): { directMessageId: string } | { roomMessageId: string };
}

const TABLES: readonly MessageTable[] = [
  {
    label: 'DirectMessage',
    withLegacyAttachment: (db) => db.$queryRaw<LegacyMessage[]>`
      SELECT "id", "senderId", "type"::text AS "type", "attachmentUrl", "attachmentName", "attachmentSize"
        FROM "DirectMessage" WHERE "attachmentUrl" IS NOT NULL ORDER BY "createdAt", "id"`,
    clearLegacy: (db, id, unavailable) => db.$executeRaw`
      UPDATE "DirectMessage"
         SET "attachmentUrl" = NULL, "attachmentName" = NULL, "attachmentSize" = NULL,
             "attachmentUnavailable" = ("attachmentUnavailable" OR ${unavailable})
       WHERE "id" = ${id}`,
    link: (id) => ({ directMessageId: id }),
  },
  {
    label: 'RoomMessage',
    withLegacyAttachment: (db) => db.$queryRaw<LegacyMessage[]>`
      SELECT "id", "senderId", "type"::text AS "type", "attachmentUrl", "attachmentName", "attachmentSize"
        FROM "RoomMessage" WHERE "attachmentUrl" IS NOT NULL ORDER BY "createdAt", "id"`,
    clearLegacy: (db, id, unavailable) => db.$executeRaw`
      UPDATE "RoomMessage"
         SET "attachmentUrl" = NULL, "attachmentName" = NULL, "attachmentSize" = NULL,
             "attachmentUnavailable" = ("attachmentUnavailable" OR ${unavailable})
       WHERE "id" = ${id}`,
    link: (id) => ({ roomMessageId: id }),
  },
];

/** The Attachment kind follows the message type; other message types never carried a file. */
function kindOf(type: string): 'IMAGE' | 'DOCUMENT' | null {
  if (type === MessageType.IMAGE) return 'IMAGE';
  if (type === MessageType.DOCUMENT) return 'DOCUMENT';
  return null;
}

/** `label: count` followed by the per-row lines, or nothing when there was nothing to do. */
function summary(label: string, count: number, lines: string[] = []): string[] {
  return count === 0 ? [] : [`${label}: ${count}`, ...lines];
}

function originalNameOf(message: LegacyMessage, storageKey: string): string {
  const name = message.attachmentName?.trim() || storageKey.split('/').pop() || 'attachment';
  return truncateCharacters(name, ATTACHMENT_RULES.NAME_MAX_LENGTH);
}

function sizeOf(message: LegacyMessage): number {
  const size = message.attachmentSize;
  return size !== null && Number.isInteger(size) && size > 0 ? size : 0;
}

/**
 * Steps 4 and 5 of the data upgrade: every message still carrying a legacy attachment URL either
 * gets an Attachment record (a bucket object, on an image or document message) or loses the
 * attachment and is marked `attachmentUnavailable`. Its `content` is kept either way, and the
 * legacy columns are cleared, so a second run finds nothing to do.
 */
export function createLegacyAttachmentsStep(bucketUrl: string | null): UpgradeStep {
  return {
    name: 'migrate-legacy-attachments',
    async run({ db, storage }) {
      const contentTypes = new Map((await storage.list()).map((o) => [o.storageKey, o.contentType]));
      const usedKeys = new Set((await db.attachment.findMany({ select: { storageKey: true } })).map((a) => a.storageKey));

      let created = 0;
      const removed: string[] = [];
      for (const table of TABLES) {
        if (!(await hasLegacyColumn(db, table.label, 'attachmentUrl'))) continue;
        for (const message of await table.withLegacyAttachment(db)) {
          const storageKey = storageKeyOfLegacyUrl(message.attachmentUrl ?? '', bucketUrl);
          const kind = kindOf(message.type);

          if (storageKey && kind && !usedKeys.has(storageKey)) {
            usedKeys.add(storageKey);
            await db.attachment.create({
              data: {
                uploaderId: message.senderId,
                storageKey,
                kind,
                mimeType: contentTypes.get(storageKey) || UNKNOWN_MIME_TYPE,
                size: sizeOf(message),
                originalName: originalNameOf(message, storageKey),
                ...table.link(message.id),
              },
            });
            await table.clearLegacy(db, message.id, false);
            created++;
            continue;
          }

          await table.clearLegacy(db, message.id, true);
          const reason = !storageKey
            ? 'URL is not an object of the project bucket'
            : !kind
              ? `a ${message.type} message cannot carry an attachment`
              : 'its object is already the attachment of another message';
          removed.push(`${table.label} ${message.id}: attachment removed (${reason})`);
        }
      }

      return {
        changed: created + removed.length,
        details: [...summary('Attachments created', created), ...summary('Messages whose attachment was removed', removed.length, removed)],
      };
    },
  };
}

/**
 * Step 6: an `EMOJI_GIF` message whose URL (its `content`) is not an https Giphy URL becomes a
 * `TEXT` message with empty content, marked `attachmentUnavailable`.
 */
export const convertForeignGifsStep: UpgradeStep = {
  name: 'convert-foreign-gifs',
  async run({ db }) {
    const details: string[] = [];
    const tables = [
      { label: 'DirectMessage', model: db.directMessage },
      { label: 'RoomMessage', model: db.roomMessage },
    ] as const;
    for (const { label, model } of tables) {
      // The two delegates share these method shapes; TypeScript cannot unify their unions.
      const delegate = model as unknown as typeof db.directMessage;
      const gifs = await delegate.findMany({
        where: { type: MessageType.EMOJI_GIF },
        select: { id: true, content: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      for (const gif of gifs.filter((m) => !isAllowedGifUrl(m.content))) {
        await delegate.update({
          where: { id: gif.id },
          data: { type: MessageType.TEXT, content: '', attachmentUnavailable: true },
        });
        details.push(`${label} ${gif.id}: GIF not from Giphy removed, message is now text`);
      }
    }
    return { changed: details.length, details: summary('Messages whose GIF was removed', details.length, details) };
  },
};

/** Step 8: deletes every bucket object that no Attachment references. */
export const deleteOrphanedObjectsStep: UpgradeStep = {
  name: 'delete-orphaned-objects',
  async run({ db, storage }) {
    const objects = await storage.list();
    const referenced = new Set((await db.attachment.findMany({ select: { storageKey: true } })).map((a) => a.storageKey));
    const orphans = objects.map((o) => o.storageKey).filter((key) => !referenced.has(key));
    for (const key of orphans) {
      await storage.delete(key);
    }
    return {
      changed: orphans.length,
      details: summary(
        'Objects deleted',
        orphans.length,
        orphans.map((key) => `Object ${show(key)}: deleted, no Attachment references it`)
      ),
    };
  },
};

/** In run order: orphans are only known once every legacy URL has become an Attachment. */
export function createAttachmentSteps(storage: StorageConfig): readonly UpgradeStep[] {
  return [createLegacyAttachmentsStep(legacyBucketUrl(storage)), convertForeignGifsStep, deleteOrphanedObjectsStep];
}
