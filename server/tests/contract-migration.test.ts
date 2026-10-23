import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';
import type { StorageConfig } from '../src/config.js';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { runUpgradeCommand } from '../src/upgrade/runner.js';
import { upgradeSteps } from '../src/upgrade/steps.js';
import { LAST_EXPAND_MIGRATION, applyMigrations, createMigratedDatabase, listMigrations } from './helpers/migrations.js';

// Seam 3: the contract migration (ticket 20). Production data is loaded at the baseline, the
// expand migrations run, then the data upgrade command, then the contract migration. From then
// on the database itself refuses data that breaks the account and room rules.

const LAST_MIGRATION_BEFORE_EXPAND = '20261023000000_enable_rls';
const CONTRACT_MIGRATION = '20261027000000_contract';

const STORAGE: StorageConfig = {
  provider: 'supabase',
  url: 'https://proj.supabase.co',
  secretKey: 'sb_secret_test',
  bucket: 'attachments',
};
const BUCKET_URL = 'https://proj.supabase.co/storage/v1/object/public/attachments/';
const PHOTO_KEY = '1700000000000-a1b2c3-photo.png';

const ids = {
  alice: 'aaaaaa01-0000-4000-8000-000000000001',
  aliceUpper: 'bbbbbb02-0000-4000-8000-000000000002',
  bob: 'cccccc03-0000-4000-8000-000000000003',
  bobLower: 'dddddd04-0000-4000-8000-000000000004',
  chat: 'eeeeee05-0000-4000-8000-000000000005',
  room: 'ffffff06-0000-4000-8000-000000000006',
  dmPhoto: '10000001-0000-4000-8000-000000000001',
  rmJavascript: '20000001-0000-4000-8000-000000000001',
};

/** Junk the way production has it, loaded before the expand migrations. */
async function loadJunk(db: PGlite) {
  const users: [string, string, string, string | null, string][] = [
    [ids.alice, 'alice', 'alice@x.io', null, '2026-01-01T00:00:01Z'],
    [ids.aliceUpper, 'Alice', 'alice2@x.io', 'https://attacker.example/a.png', '2026-01-01T00:00:02Z'],
    [ids.bob, 'bob', 'Bob@X.io', 'javascript:alert(1)', '2026-01-01T00:00:03Z'],
    [ids.bobLower, 'bobby', 'bob@x.io', null, '2026-01-01T00:00:04Z'],
  ];
  for (const [id, username, email, avatarUrl, createdAt] of users) {
    await db.query(
      `INSERT INTO "User" (id, username, email, "passwordHash", "avatarUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'hash', $4, $5, $5)`,
      [id, username, email, avatarUrl, createdAt]
    );
  }
  await db.query(`INSERT INTO "DirectChat" (id, "user1Id", "user2Id", "updatedAt") VALUES ($1, $2, $3, now())`, [
    ids.chat,
    ids.alice,
    ids.bob,
  ]);
  await db.query(
    `INSERT INTO "Room" (id, name, description, "ownerId", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
    [ids.room, 'Team\r\n' + 'n'.repeat(100), 'd'.repeat(600), ids.alice]
  );
  await db.query(
    `INSERT INTO "DirectMessage" (id, "directChatId", "senderId", content, type, "attachmentUrl", "attachmentName", "attachmentSize", "updatedAt")
     VALUES ($1, $2, $3, 'look', 'IMAGE', $4, 'photo.png', -1, now())`,
    [ids.dmPhoto, ids.chat, ids.alice, BUCKET_URL + PHOTO_KEY]
  );
  await db.query(
    `INSERT INTO "RoomMessage" (id, "roomId", "senderId", content, type, "attachmentUrl", "attachmentName", "attachmentSize", "updatedAt")
     VALUES ($1, $2, $3, 'caption kept', 'DOCUMENT', 'javascript:alert(1)', 'x.pdf', 10, now())`,
    [ids.rmJavascript, ids.room, ids.bob]
  );
}

async function appliedMigrations(db: PGlite): Promise<string[]> {
  const result = await db.query<{ migration_name: string }>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`
  );
  return result.rows.map((row) => row.migration_name);
}

async function columnsOf(db: PGlite, table: string): Promise<string[]> {
  const result = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

describe('Contract migration (seam 3)', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createMigratedDatabase({ until: LAST_MIGRATION_BEFORE_EXPAND });
    await loadJunk(db);
    await applyMigrations(db, { until: LAST_EXPAND_MIGRATION });
  }, 30_000);

  afterEach(async () => {
    await db.close();
  });

  it('is the last migration, right after the expand migrations', () => {
    const names = listMigrations().map((m) => m.name);
    expect(names.at(-1)).toBe(CONTRACT_MIGRATION);
    expect(names.at(-2)).toBe(LAST_EXPAND_MIGRATION);
  });

  describe('before the data upgrade command has run', () => {
    it('fails with a message naming the data upgrade command, and changes nothing', async () => {
      await expect(applyMigrations(db)).rejects.toThrow(/db:upgrade-data/);

      expect(await appliedMigrations(db)).not.toContain(CONTRACT_MIGRATION);
      expect(await columnsOf(db, 'User')).toContain('avatarUrl');
      expect(await columnsOf(db, 'DirectMessage')).toContain('attachmentUrl');
      const rows = await db.query(`SELECT "attachmentUrl" FROM "RoomMessage" WHERE id = $1`, [ids.rmJavascript]);
      expect(rows.rows).toEqual([{ attachmentUrl: 'javascript:alert(1)' }]);
    });

    it('also refuses when only a legacy attachment URL is left', async () => {
      await runDataUpgrade(db);
      await db.query(`UPDATE "RoomMessage" SET "attachmentUrl" = 'https://evil.example/x.pdf' WHERE id = $1`, [
        ids.rmJavascript,
      ]);

      await expect(applyMigrations(db)).rejects.toThrow(/1 RoomMessage row\(s\) with a legacy attachmentUrl/);
      expect(await appliedMigrations(db)).not.toContain(CONTRACT_MIGRATION);
    });
  });

  describe('after the data upgrade command has run', () => {
    let prisma: PrismaClient;

    beforeEach(async () => {
      await runDataUpgrade(db);
      await applyMigrations(db);
      prisma = new PrismaClient({ adapter: new PrismaPGlite(db) });
    }, 30_000);

    afterEach(async () => {
      await prisma.$disconnect();
    });

    const insertUser = (id: string, username: string, usernameNormalized: string | null, email: string) =>
      db.query(
        `INSERT INTO "User" (id, username, "usernameNormalized", email, "passwordHash", "updatedAt")
         VALUES ($1, $2, $3, $4, 'hash', now())`,
        [id, username, usernameNormalized, email]
      );
    const insertRoom = (name: string, description: string | null) =>
      db.query(`INSERT INTO "Room" (id, name, description, "ownerId", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, now())`, [
        name,
        description,
        ids.alice,
      ]);
    const newId = () => crypto.randomUUID();

    it('applies, and drops the legacy columns but keeps attachmentUnavailable', async () => {
      expect(await appliedMigrations(db)).toContain(CONTRACT_MIGRATION);
      expect(await columnsOf(db, 'User')).not.toContain('avatarUrl');
      for (const table of ['DirectMessage', 'RoomMessage']) {
        const columns = await columnsOf(db, table);
        expect(columns).not.toContain('attachmentUrl');
        expect(columns).not.toContain('attachmentName');
        expect(columns).not.toContain('attachmentSize');
        expect(columns).toContain('attachmentUnavailable');
      }
    });

    it('keeps the upgraded data: the Attachment, the unavailable flag and the renamed account', async () => {
      const photo = await prisma.directMessage.findUniqueOrThrow({ where: { id: ids.dmPhoto }, include: { attachment: true } });
      expect(photo.attachment).toMatchObject({ storageKey: PHOTO_KEY, uploaderId: ids.alice });
      const removed = await prisma.roomMessage.findUniqueOrThrow({ where: { id: ids.rmJavascript } });
      expect(removed).toMatchObject({ content: 'caption kept', attachmentUnavailable: true });
      const renamed = await prisma.user.findUniqueOrThrow({ where: { id: ids.aliceUpper } });
      expect(renamed).toMatchObject({ username: 'user_bbbbbb', usernameNormalized: 'user_bbbbbb' });
    });

    it('refuses a direct insert of `Alice` when `alice` exists, however the key is filled', async () => {
      await expect(insertUser(newId(), 'Alice', 'alice', 'a1@x.io')).rejects.toThrow(/User_usernameNormalized_key/);
      await expect(insertUser(newId(), 'Alice', 'Alice', 'a2@x.io')).rejects.toThrow(/User_usernameNormalized_check/);
      await expect(insertUser(newId(), 'Alice', null, 'a3@x.io')).rejects.toThrow(/null value.*usernameNormalized/);

      await insertUser(newId(), 'AliceW', 'alicew', 'a4@x.io');
    });

    it('refuses an email that is not lowercase, and a duplicate email', async () => {
      await expect(insertUser(newId(), 'dave', 'dave', 'Dave@X.io')).rejects.toThrow(/User_email_lowercase_check/);
      await expect(insertUser(newId(), 'dave', 'dave', 'alice@x.io')).rejects.toThrow(/User_email_key/);
    });

    it('refuses a room name over 64 characters or blank, and a description over 500', async () => {
      await insertRoom('n'.repeat(64), 'd'.repeat(500));
      await insertRoom('ok', null);

      await expect(insertRoom('n'.repeat(65), null)).rejects.toThrow(/Room_name_length_check/);
      await expect(insertRoom('', null)).rejects.toThrow(/Room_name_length_check/);
      await expect(insertRoom('   ', null)).rejects.toThrow(/Room_name_length_check/);
      await expect(insertRoom('ok', 'd'.repeat(501))).rejects.toThrow(/Room_description_length_check/);
    });

    it('leaves Row Level Security enabled on every table', async () => {
      const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(`
        SELECT c.relname, c.relrowsecurity FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
         WHERE c.relkind IN ('r', 'p') ORDER BY c.relname`);

      expect(tables.rows.map((t) => t.relname)).toEqual(
        expect.arrayContaining(['_prisma_migrations', 'User', 'Session', 'Attachment', 'DirectMessage', 'RoomMessage'])
      );
      expect(tables.rows.filter((t) => !t.relrowsecurity)).toEqual([]);
    });

    it('a later data upgrade run still works and changes nothing', async () => {
      const report = await runDataUpgrade(db, prisma);

      expect(report.totalChanged).toBe(0);
    });
  });
});

/** Runs the real data upgrade command (all registered steps) against `db`. */
async function runDataUpgrade(db: PGlite, client?: PrismaClient) {
  const prisma = client ?? new PrismaClient({ adapter: new PrismaPGlite(db) });
  const storage = new InMemoryStorageAdapter();
  storage.putObject(PHOTO_KEY, Buffer.from('png bytes'), 'image/png');
  try {
    return await runUpgradeCommand([], { prisma, storage, steps: upgradeSteps(STORAGE), log: () => {} });
  } finally {
    if (!client) await prisma.$disconnect();
  }
}
