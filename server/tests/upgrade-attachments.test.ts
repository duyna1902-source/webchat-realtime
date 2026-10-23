import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';
import type { StorageConfig } from '../src/config.js';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { runUpgradeCommand, UpgradeReport } from '../src/upgrade/runner.js';
import { upgradeSteps } from '../src/upgrade/steps.js';
import { applyMigrations, createMigratedDatabase } from './helpers/migrations.js';

// Seam 3: the legacy attachment steps of the data upgrade command (ticket 14, ADR 0009), run on
// junk messages loaded the way production has them (before the expand migrations), with an
// in-memory bucket holding both referenced and orphaned objects.

const LAST_MIGRATION_BEFORE_EXPAND = '20261023000000_enable_rls';

const STORAGE: StorageConfig = {
  provider: 'supabase',
  url: 'https://proj.supabase.co',
  secretKey: 'sb_secret_test',
  bucket: 'attachments',
};
const BUCKET_URL = 'https://proj.supabase.co/storage/v1/object/public/attachments/';

const keys = {
  photo: '1700000000000-a1b2c3-photo.png',
  report: '1700000000001-d4e5f6-report.pdf',
  missing: '1700000000002-g7h8i9-gone.png',
  plantedRoot: 'planted.html',
  plantedNested: 'folder/evil.svg',
};

const ids = {
  alice: 'aaaaaa01-0000-4000-8000-000000000001',
  bob: 'bbbbbb02-0000-4000-8000-000000000002',
  chat: 'cccccc03-0000-4000-8000-000000000003',
  room: 'dddddd04-0000-4000-8000-000000000004',
  // Direct Messages
  dmImage: '10000001-0000-4000-8000-000000000001',
  dmJavascript: '10000002-0000-4000-8000-000000000002',
  dmForeign: '10000003-0000-4000-8000-000000000003',
  dmEmpty: '10000004-0000-4000-8000-000000000004',
  dmGifForeign: '10000005-0000-4000-8000-000000000005',
  dmGifGiphy: '10000006-0000-4000-8000-000000000006',
  dmText: '10000007-0000-4000-8000-000000000007',
  // Room Messages
  rmDocument: '20000001-0000-4000-8000-000000000001',
  rmLookalike: '20000002-0000-4000-8000-000000000002',
  rmOtherBucket: '20000003-0000-4000-8000-000000000003',
  rmMissing: '20000004-0000-4000-8000-000000000004',
  rmSameObject: '20000005-0000-4000-8000-000000000005',
};

const LONG_NAME = 'r'.repeat(300) + '.pdf';
const GIPHY_GIF = 'https://media.giphy.com/media/abc/giphy.gif';

type Row = [id: string, sender: string, type: string, content: string, url: string | null, name: string | null, size: number | null, createdAt: string];

async function loadJunk(db: PGlite) {
  for (const [id, username] of [
    [ids.alice, 'alice'],
    [ids.bob, 'bob'],
  ]) {
    await db.query(
      `INSERT INTO "User" (id, username, email, "passwordHash", "updatedAt") VALUES ($1, $2, $3, 'hash', now())`,
      [id, username, `${username}@x.io`]
    );
  }
  await db.query(`INSERT INTO "DirectChat" (id, "user1Id", "user2Id", "updatedAt") VALUES ($1, $2, $3, now())`, [
    ids.chat,
    ids.alice,
    ids.bob,
  ]);
  for (const userId of [ids.alice, ids.bob]) {
    await db.query(`INSERT INTO "DirectChatParticipant" (id, "directChatId", "userId", "updatedAt") VALUES (gen_random_uuid(), $1, $2, now())`, [
      ids.chat,
      userId,
    ]);
  }
  await db.query(`INSERT INTO "Room" (id, name, "ownerId", "updatedAt") VALUES ($1, 'general', $2, now())`, [
    ids.room,
    ids.alice,
  ]);

  const direct: Row[] = [
    [ids.dmImage, ids.alice, 'IMAGE', 'look at this', BUCKET_URL + keys.photo, 'photo.png', 1234, '2026-01-01T00:00:01Z'],
    [ids.dmJavascript, ids.bob, 'IMAGE', 'caption kept', 'javascript:alert(document.cookie)', 'x.png', 10, '2026-01-01T00:00:02Z'],
    [ids.dmForeign, ids.bob, 'DOCUMENT', 'see doc', 'https://evil.example/x.pdf', 'x.pdf', -5, '2026-01-01T00:00:03Z'],
    [ids.dmEmpty, ids.bob, 'DOCUMENT', 'empty url', '', 'y.pdf', 1, '2026-01-01T00:00:04Z'],
    [ids.dmGifForeign, ids.bob, 'EMOJI_GIF', 'https://evil.example/a.gif', null, null, null, '2026-01-01T00:00:05Z'],
    [ids.dmGifGiphy, ids.alice, 'EMOJI_GIF', GIPHY_GIF, null, null, null, '2026-01-01T00:00:06Z'],
    [ids.dmText, ids.alice, 'TEXT', 'hello', null, null, null, '2026-01-01T00:00:07Z'],
  ];
  for (const [id, senderId, type, content, url, name, size, createdAt] of direct) {
    await db.query(
      `INSERT INTO "DirectMessage" (id, "directChatId", "senderId", content, type, "attachmentUrl", "attachmentName", "attachmentSize", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"MessageType", $6, $7, $8, $9, $9)`,
      [id, ids.chat, senderId, content, type, url, name, size, createdAt]
    );
  }

  const room: Row[] = [
    [ids.rmDocument, ids.bob, 'DOCUMENT', '', BUCKET_URL + keys.report, LONG_NAME, -10, '2026-01-02T00:00:01Z'],
    [ids.rmLookalike, ids.bob, 'IMAGE', 'lookalike', `https://proj.supabase.co.evil.example/storage/v1/object/public/attachments/${keys.photo}`, 'p.png', 3, '2026-01-02T00:00:02Z'],
    [ids.rmOtherBucket, ids.bob, 'IMAGE', 'other bucket', `https://proj.supabase.co/storage/v1/object/public/other/${keys.photo}`, 'p.png', 3, '2026-01-02T00:00:03Z'],
    [ids.rmMissing, ids.alice, 'IMAGE', '', BUCKET_URL + keys.missing, 'gone.png', null, '2026-01-02T00:00:04Z'],
    [ids.rmSameObject, ids.bob, 'IMAGE', 'same object', BUCKET_URL + keys.photo, 'photo.png', 1234, '2026-01-02T00:00:05Z'],
  ];
  for (const [id, senderId, type, content, url, name, size, createdAt] of room) {
    await db.query(
      `INSERT INTO "RoomMessage" (id, "roomId", "senderId", content, type, "attachmentUrl", "attachmentName", "attachmentSize", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"MessageType", $6, $7, $8, $9, $9)`,
      [id, ids.room, senderId, content, type, url, name, size, createdAt]
    );
  }
}

function loadBucket(): InMemoryStorageAdapter {
  const storage = new InMemoryStorageAdapter();
  storage.putObject(keys.photo, Buffer.from('png bytes'), 'image/png');
  // Uploaded by the legacy adapter without a content type in its metadata.
  storage.putObject(keys.report, Buffer.from('%PDF-1.4'));
  storage.putObject(keys.plantedRoot, Buffer.from('<script>alert(1)</script>'), 'text/html');
  storage.putObject(keys.plantedNested, Buffer.from('<svg onload=alert(1)>'), 'image/svg+xml');
  return storage;
}

describe('Data upgrade: legacy attachments (seam 3)', () => {
  let db: PGlite;
  let prisma: PrismaClient;
  let storage: InMemoryStorageAdapter;
  let output: string[];

  const run = (argv: string[] = []) =>
    runUpgradeCommand(argv, {
      prisma,
      storage,
      steps: upgradeSteps(STORAGE),
      log: (line) => output.push(line),
    });
  const directMessage = (id: string) => prisma.directMessage.findUniqueOrThrow({ where: { id }, include: { attachment: true } });
  const roomMessage = (id: string) => prisma.roomMessage.findUniqueOrThrow({ where: { id }, include: { attachment: true } });
  const snapshot = async () => ({
    direct: await prisma.directMessage.findMany({ orderBy: { id: 'asc' } }),
    room: await prisma.roomMessage.findMany({ orderBy: { id: 'asc' } }),
    attachments: await prisma.attachment.findMany({ orderBy: { id: 'asc' } }),
    objects: (await storage.list()).map((o) => o.storageKey).sort(),
  });
  const stepChanges = (report: UpgradeReport, name: string) => report.steps.find((s) => s.name === name)?.changed;

  beforeEach(async () => {
    db = await createMigratedDatabase({ until: LAST_MIGRATION_BEFORE_EXPAND });
    await loadJunk(db);
    await applyMigrations(db);
    prisma = new PrismaClient({ adapter: new PrismaPGlite(db) });
    storage = loadBucket();
    output = [];
  }, 30_000);

  afterEach(async () => {
    await prisma.$disconnect();
    await db.close();
  });

  it('turns a message whose URL points into the project bucket into an Attachment the sender uploaded', async () => {
    await run();

    const message = await directMessage(ids.dmImage);
    expect(message).toMatchObject({ type: 'IMAGE', content: 'look at this', attachmentUnavailable: false });
    expect(message.attachment).toMatchObject({
      uploaderId: ids.alice,
      storageKey: keys.photo,
      kind: 'IMAGE',
      mimeType: 'image/png',
      size: 1234,
      originalName: 'photo.png',
      roomMessageId: null,
    });
  });

  it('keeps the file name within 255 characters, a negative size as 0 and an unknown type as octet-stream', async () => {
    await run();

    const document = await roomMessage(ids.rmDocument);
    expect(document.type).toBe('DOCUMENT');
    expect(document.attachment).toMatchObject({
      uploaderId: ids.bob,
      storageKey: keys.report,
      kind: 'DOCUMENT',
      mimeType: 'application/octet-stream',
      size: 0,
      originalName: LONG_NAME.slice(0, 255),
    });

    // Points into the bucket but the object is gone: still a record, nothing to read type from.
    expect((await roomMessage(ids.rmMissing)).attachment).toMatchObject({
      storageKey: keys.missing,
      kind: 'IMAGE',
      mimeType: 'application/octet-stream',
      size: 0,
      originalName: 'gone.png',
    });
  });

  it('removes an attachment whose URL is not an object of the bucket, keeping the text', async () => {
    await run();

    const expected: [string, string][] = [
      [ids.dmJavascript, 'caption kept'],
      [ids.dmForeign, 'see doc'],
      [ids.dmEmpty, 'empty url'],
    ];
    for (const [id, content] of expected) {
      expect(await directMessage(id)).toMatchObject({
        content,
        attachment: null,
        attachmentUnavailable: true,
        attachmentUrl: null,
        attachmentName: null,
        attachmentSize: null,
      });
    }
    for (const [id, content] of [
      [ids.rmLookalike, 'lookalike'],
      [ids.rmOtherBucket, 'other bucket'],
    ]) {
      expect(await roomMessage(id)).toMatchObject({ content, attachment: null, attachmentUnavailable: true });
    }
  });

  it('gives an object to one message only: a second message pointing at it loses its attachment', async () => {
    await run();

    expect((await directMessage(ids.dmImage)).attachment?.storageKey).toBe(keys.photo);
    expect(await roomMessage(ids.rmSameObject)).toMatchObject({ attachment: null, attachmentUnavailable: true });
  });

  it('turns a GIF that is not from Giphy into an empty text message marked unavailable', async () => {
    await run();

    expect(await directMessage(ids.dmGifForeign)).toMatchObject({ type: 'TEXT', content: '', attachmentUnavailable: true });
    expect(await directMessage(ids.dmGifGiphy)).toMatchObject({ type: 'EMOJI_GIF', content: GIPHY_GIF, attachmentUnavailable: false });
    expect(await directMessage(ids.dmText)).toMatchObject({ type: 'TEXT', content: 'hello', attachmentUnavailable: false });
  });

  it('deletes every bucket object no Attachment references and keeps the referenced ones', async () => {
    await run();

    expect((await storage.list()).map((o) => o.storageKey).sort()).toEqual([keys.photo, keys.report].sort());
    expect(storage.getObject(keys.photo)?.data.toString()).toBe('png bytes');
  });

  it('reports how many messages lost their attachment and how many objects were deleted', async () => {
    const report = await run();

    expect(stepChanges(report, 'migrate-legacy-attachments')).toBe(9);
    expect(stepChanges(report, 'convert-foreign-gifs')).toBe(1);
    expect(stepChanges(report, 'delete-orphaned-objects')).toBe(2);
    const printed = output.join('\n');
    expect(printed).toContain('Attachments created: 3');
    expect(printed).toContain('Messages whose attachment was removed: 6');
    expect(printed).toContain('Messages whose GIF was removed: 1');
    expect(printed).toContain('Objects deleted: 2');
    expect(printed).toContain(`DirectMessage ${ids.dmJavascript}: attachment removed`);
    expect(printed).toContain(`Object "${keys.plantedNested}": deleted`);
    expect(printed).not.toContain('javascript:');
  });

  it('a dry run reports the same counts and changes neither the database nor the bucket', async () => {
    const before = await snapshot();

    const report = await run(['--dry-run']);

    expect(stepChanges(report, 'migrate-legacy-attachments')).toBe(9);
    expect(stepChanges(report, 'convert-foreign-gifs')).toBe(1);
    expect(stepChanges(report, 'delete-orphaned-objects')).toBe(2);
    expect(report.steps.find((s) => s.name === 'delete-orphaned-objects')?.skippedStorageWrites).toEqual(['delete', 'delete']);
    expect(await snapshot()).toEqual(before);
  });

  it('a second run changes nothing', async () => {
    await run();
    const after = await snapshot();

    const second = await run();

    expect(second.totalChanged).toBe(0);
    expect(second.steps.flatMap((s) => s.details)).toEqual([]);
    expect(await snapshot()).toEqual(after);
  });
});
