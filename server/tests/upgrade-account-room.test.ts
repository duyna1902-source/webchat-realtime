import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { runUpgradeCommand, UpgradeReport } from '../src/upgrade/runner.js';
import { upgradeSteps } from '../src/upgrade/steps.js';
import { LAST_EXPAND_MIGRATION, applyMigrations, createMigratedDatabase } from './helpers/migrations.js';

// Seam 3: the account and room steps of the data upgrade command (ticket 07), run on junk data
// loaded the way production has it (before the expand migration), then the expand migrations.
// After the command, the contract migration (ticket 20) applies.

const LAST_MIGRATION_BEFORE_EXPAND = '20261023000000_enable_rls';

const ids = {
  crlf: 'aaaaaa01-0000-4000-8000-000000000001',
  huge: 'bbbbbb02-0000-4000-8000-000000000002',
  aliceLower: 'cccccc03-0000-4000-8000-000000000003',
  aliceUpper: 'dddddd04-0000-4000-8000-000000000004',
  bobUpper: 'eeeeee05-0000-4000-8000-000000000005',
  bobLower: 'ffffff06-0000-4000-8000-000000000006',
  carol: '11111107-0000-4000-8000-000000000007',
  roomLong: '22222208-0000-4000-8000-000000000008',
  roomBlank: '33333309-0000-4000-8000-000000000009',
  roomOk: '4444440a-0000-4000-8000-00000000000a',
};

const HUGE_USERNAME = 'x'.repeat(50_000);
const LONG_ROOM_NAME = 'Team\r\n' + 'n'.repeat(100);
const LONG_DESCRIPTION = '  about\u0007 ' + 'd'.repeat(600);

async function loadJunk(db: PGlite) {
  const users: [string, string, string, string | null, string][] = [
    [ids.crlf, 'crlf\r\nX-Injected: 1', 'crlf@x.io', null, '2026-01-01T00:00:01Z'],
    [ids.huge, HUGE_USERNAME, 'huge@x.io', 'javascript:alert(1)', '2026-01-01T00:00:02Z'],
    [ids.aliceLower, 'alice', 'alice@x.io', null, '2026-01-01T00:00:03Z'],
    [ids.aliceUpper, 'Alice', 'alice2@x.io', 'https://attacker.example/a.png', '2026-01-01T00:00:04Z'],
    [ids.bobUpper, 'bob', 'Bob@X.io', null, '2026-01-01T00:00:05Z'],
    [ids.bobLower, 'bobby', 'bob@x.io', null, '2026-01-01T00:00:06Z'],
    [ids.carol, 'carol', 'carol@x.io', null, '2026-01-01T00:00:07Z'],
  ];
  for (const [id, username, email, avatarUrl, createdAt] of users) {
    await db.query(
      `INSERT INTO "User" (id, username, email, "passwordHash", "avatarUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'hash', $4, $5, $5)`,
      [id, username, email, avatarUrl, createdAt]
    );
  }
  const rooms: [string, string, string | null][] = [
    [ids.roomLong, LONG_ROOM_NAME, LONG_DESCRIPTION],
    [ids.roomBlank, ' \t\u0001 ', '\r\n'],
    [ids.roomOk, 'general', 'All good'],
  ];
  for (const [id, name, description] of rooms) {
    await db.query(
      `INSERT INTO "Room" (id, name, description, "ownerId", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
      [id, name, description, ids.carol]
    );
  }
}

describe('Data upgrade: account and room rules (seam 3)', () => {
  let db: PGlite;
  let prisma: PrismaClient;
  let output: string[];

  const run = (argv: string[] = []) =>
    runUpgradeCommand(argv, {
      prisma,
      storage: new InMemoryStorageAdapter(),
      steps: upgradeSteps({ provider: 'local' }),
      log: (line) => output.push(line),
    });
  const users = () => prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const room = (id: string) => prisma.room.findUniqueOrThrow({ where: { id } });
  const details = (report: UpgradeReport) => report.steps.flatMap((step) => step.details);

  beforeEach(async () => {
    db = await createMigratedDatabase({ until: LAST_MIGRATION_BEFORE_EXPAND });
    await loadJunk(db);
    await applyMigrations(db, { until: LAST_EXPAND_MIGRATION });
    prisma = new PrismaClient({ adapter: new PrismaPGlite(db) });
    output = [];
  }, 30_000);

  afterEach(async () => {
    await prisma.$disconnect();
    await db.close();
  });

  it('a dry run reports the changes and leaves the database untouched', async () => {
    const before = await users();

    const report = await run(['--dry-run']);

    expect(report.totalChanged).toBeGreaterThan(0);
    expect(await users()).toEqual(before);
    expect((await room(ids.roomLong)).name).toBe(LONG_ROOM_NAME);
  });

  it('renames invalid and case-duplicate usernames, keeping the account created first', async () => {
    await run();

    const byId = new Map((await users()).map((u) => [u.id, u]));
    expect(byId.get(ids.crlf)!.username).toBe('user_aaaaaa');
    expect(byId.get(ids.huge)!.username).toBe('user_bbbbbb');
    expect(byId.get(ids.aliceLower)!.username).toBe('alice');
    expect(byId.get(ids.aliceUpper)!.username).toBe('user_dddddd');
    expect(byId.get(ids.carol)!.username).toBe('carol');
  });

  it('lowercases emails and marks the later duplicate with +dup<n>', async () => {
    await run();

    const byId = new Map((await users()).map((u) => [u.id, u]));
    expect(byId.get(ids.bobUpper)!.email).toBe('bob@x.io');
    expect(byId.get(ids.bobLower)!.email).toBe('bob+dup1@x.io');
  });

  it('fills the normalized username key and clears every avatarUrl', async () => {
    await run();

    for (const user of await users()) {
      expect(user.usernameNormalized).toBe(user.username.toLowerCase());
    }
    // The column is no longer in the Prisma schema: the contract migration drops it.
    const avatars = await db.query(`SELECT id FROM "User" WHERE "avatarUrl" IS NOT NULL`);
    expect(avatars.rows).toEqual([]);
  });

  it('trims and cleans room names and descriptions, naming an empty room after its id', async () => {
    await run();

    const long = await room(ids.roomLong);
    expect(long.name).toBe(('Team' + 'n'.repeat(100)).slice(0, 64));
    expect(long.description).toBe(('about ' + 'd'.repeat(600)).slice(0, 500));

    const blank = await room(ids.roomBlank);
    expect(blank.name).toBe('Room 333333');
    expect(blank.description).toBeNull();

    const ok = await room(ids.roomOk);
    expect(ok).toMatchObject({ name: 'general', description: 'All good' });
  });

  it('leaves every row valid under the account and room rules', async () => {
    await run();

    const all = await users();
    for (const user of all) {
      expect(user.username).toMatch(/^[a-zA-Z0-9_.]{3,32}$/);
      expect(user.email).toBe(user.email.toLowerCase());
    }
    expect(new Set(all.map((u) => u.username.toLowerCase())).size).toBe(all.length);
    expect(new Set(all.map((u) => u.email)).size).toBe(all.length);

    for (const r of await prisma.room.findMany()) {
      expect(Array.from(r.name).length).toBeGreaterThanOrEqual(1);
      expect(Array.from(r.name).length).toBeLessThanOrEqual(64);
      expect(r.name).not.toMatch(/\p{Cc}/u);
      expect(Array.from(r.description ?? '').length).toBeLessThanOrEqual(500);
      expect(r.description ?? '').not.toMatch(/\p{Cc}/u);
    }

    // So the contract migration, which enforces these rules in the database, now applies.
    await expect(applyMigrations(db)).resolves.toContain('20261027000000_contract');
  });

  it('reports every changed account and room value as old -> new', async () => {
    const report = await run();
    const lines = details(report);

    expect(lines).toContain(`User ${ids.crlf}: username "crlf\\r\\nX-Injected: 1" -> "user_aaaaaa"`);
    expect(lines).toContain(`User ${ids.aliceUpper}: username "Alice" -> "user_dddddd"`);
    expect(lines).toContain(`User ${ids.bobUpper}: email "Bob@X.io" -> "bob@x.io"`);
    expect(lines).toContain(`User ${ids.bobLower}: email "bob@x.io" -> "bob+dup1@x.io"`);
    expect(lines).toContain(`Room ${ids.roomBlank}: name " \\t\\u0001 " -> "Room 333333"`);
    // A 50,000-character value is shortened in the report, not printed whole.
    const huge = lines.find((line) => line.startsWith(`User ${ids.huge}: username`));
    expect(huge).toMatch(/-> "user_bbbbbb"$/);
    expect(huge!.length).toBeLessThan(300);
    expect(output.join('\n')).toContain('user_dddddd');
  });

  it('a second run changes nothing', async () => {
    await run();
    const after = await users();

    const second = await run();

    expect(second.totalChanged).toBe(0);
    expect(details(second)).toEqual([]);
    expect(await users()).toEqual(after);
  });
});
