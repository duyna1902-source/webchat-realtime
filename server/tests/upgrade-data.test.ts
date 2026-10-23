import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { runUpgradeCommand, UpgradeStep } from '../src/upgrade/runner.js';
import { createMigratedDatabase } from './helpers/migrations.js';

// Seam 3: the data upgrade command, run against a database built from the real migrations.

/** A fake step in the style of the real ones: lowercase every email, report old → new. */
const lowercaseEmails: UpgradeStep = {
  name: 'lowercase-emails',
  async run({ db }) {
    const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } });
    const details: string[] = [];
    for (const user of users) {
      const lower = user.email.toLowerCase();
      if (lower !== user.email) {
        await db.user.update({ where: { id: user.id }, data: { email: lower } });
        details.push(`${user.email} -> ${lower}`);
      }
    }
    return { changed: details.length, details };
  },
};

describe('Data upgrade command (seam 3)', () => {
  let db: PGlite;
  let prisma: PrismaClient;
  let storage: InMemoryStorageAdapter;
  let output: string[];

  const run = (argv: string[], steps: UpgradeStep[]) =>
    runUpgradeCommand(argv, { prisma, storage, steps, log: (line) => output.push(line) });
  const emails = async () => (await prisma.user.findMany({ orderBy: { username: 'asc' } })).map((u) => u.email);

  beforeEach(async () => {
    db = await createMigratedDatabase();
    prisma = new PrismaClient({ adapter: new PrismaPGlite(db) });
    storage = new InMemoryStorageAdapter();
    output = [];
    await prisma.user.createMany({
      data: [
        { username: 'bob', email: 'Bob@X.io', passwordHash: 'hash' },
        { username: 'carol', email: 'carol@x.io', passwordHash: 'hash' },
      ],
    });
  }, 30_000);

  afterEach(async () => {
    await prisma.$disconnect();
    await db.close();
  });

  it('--dry-run reports what would change but writes nothing', async () => {
    const report = await run(['--dry-run'], [lowercaseEmails]);

    expect(report.dryRun).toBe(true);
    expect(report.steps).toEqual([
      expect.objectContaining({ name: 'lowercase-emails', changed: 1, details: ['Bob@X.io -> bob@x.io'] }),
    ]);
    expect(await emails()).toEqual(['Bob@X.io', 'carol@x.io']);

    const printed = output.join('\n');
    expect(printed).toMatch(/dry run/i);
    expect(printed).toContain('lowercase-emails: 1 change');
    expect(printed).toContain('Bob@X.io -> bob@x.io');
  });

  it('a real run applies the changes, and a second run changes nothing more', async () => {
    const first = await run([], [lowercaseEmails]);
    expect(first.dryRun).toBe(false);
    expect(first.totalChanged).toBe(1);
    expect(await emails()).toEqual(['bob@x.io', 'carol@x.io']);

    const second = await run([], [lowercaseEmails]);
    expect(second.totalChanged).toBe(0);
    expect(second.steps[0]).toEqual(expect.objectContaining({ name: 'lowercase-emails', changed: 0, details: [] }));
    expect(await emails()).toEqual(['bob@x.io', 'carol@x.io']);
  });

  it('runs registered steps in order, each seeing the earlier steps\' changes, in dry run too', async () => {
    const seen: string[] = [];
    const countLowercase: UpgradeStep = {
      name: 'count-lowercase',
      async run({ db: tx }) {
        seen.push(...(await tx.user.findMany({ orderBy: { username: 'asc' } })).map((u) => u.email));
        return { changed: 0 };
      },
    };

    const report = await run(['--dry-run'], [lowercaseEmails, countLowercase]);

    expect(report.steps.map((s) => s.name)).toEqual(['lowercase-emails', 'count-lowercase']);
    expect(seen).toEqual(['bob@x.io', 'carol@x.io']);
    expect(await emails()).toEqual(['Bob@X.io', 'carol@x.io']);
  });

  it('--dry-run skips storage writes and lists them in the report', async () => {
    let uploadedUrl: string | undefined;
    const uploadStep: UpgradeStep = {
      name: 'upload-marker',
      async run({ storage: store }) {
        uploadedUrl = (await store.put(Buffer.from('hello'), { contentType: 'text/plain; charset=utf-8' }))?.url;
        return { changed: 1 };
      },
    };

    const dry = await run(['--dry-run'], [uploadStep]);
    expect(uploadedUrl).toBeUndefined();
    expect(dry.steps[0].skippedStorageWrites).toEqual(['put']);

    const real = await run([], [uploadStep]);
    expect(real.steps[0].skippedStorageWrites).toEqual([]);
    expect(storage.read(uploadedUrl!)?.toString()).toBe('hello');
  });

  it('rolls back every step when one step fails', async () => {
    const failing: UpgradeStep = {
      name: 'explode',
      async run() {
        throw new Error('boom');
      },
    };

    await expect(run([], [lowercaseEmails, failing])).rejects.toThrow('boom');
    expect(await emails()).toEqual(['Bob@X.io', 'carol@x.io']);
  });

  it('rejects unknown arguments without touching the database', async () => {
    await expect(run(['--dryrun'], [lowercaseEmails])).rejects.toThrow(/unknown argument.*--dryrun/i);
    expect(await emails()).toEqual(['Bob@X.io', 'carol@x.io']);
  });
});
