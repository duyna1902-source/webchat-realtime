import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';
import {
  applyMigrations,
  createMigratedDatabase,
  describeSchema,
  listMigrations,
  SCHEMA_SQL_PATH,
} from './helpers/migrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const SCHEMA_SQL_SCRIPT = path.join(SERVER_DIR, 'scripts', 'generate-schema-sql.mjs');

describe('Generated PGlite schema (prisma/schema.sql)', () => {
  it('is exactly what the generator produces from prisma/schema.prisma', () => {
    const result = spawnSync(process.execPath, [SCHEMA_SQL_SCRIPT, '--check'], {
      cwd: SERVER_DIR,
      encoding: 'utf8',
    });

    expect(result.stderr + result.stdout).toContain('is up to date');
    expect(result.status).toBe(0);
  }, 60_000);

  it('carries a do-not-edit notice naming the regeneration command', () => {
    const sql = fs.readFileSync(path.join(SERVER_DIR, 'prisma', 'schema.sql'), 'utf8');

    expect(sql.split(/\r?\n/)[0]).toMatch(/GENERATED.*DO NOT EDIT/i);
    expect(sql).toContain('npm run db:schema-sql');
  });
});

describe('Prisma Migrate migrations (prisma/migrations)', () => {
  it('start with the 0_baseline migration that production is marked as already having', () => {
    expect(listMigrations()[0]?.name).toBe('0_baseline');
  });

  it('build the same schema as prisma/schema.prisma (no drift between migrations and schema)', async () => {
    const migrated = await createMigratedDatabase();
    const fromSchema = new PGlite();
    await fromSchema.exec(fs.readFileSync(SCHEMA_SQL_PATH, 'utf8'));

    const expected = await describeSchema(fromSchema);
    expect(expected.length).toBeGreaterThan(50);
    expect(await describeSchema(migrated)).toEqual(expected);

    await Promise.all([migrated.close(), fromSchema.close()]);
  }, 30_000);
});

describe('Render deploy', () => {
  it('applies pending migrations with `prisma migrate deploy` before starting the server', () => {
    const renderYaml = fs.readFileSync(path.resolve(SERVER_DIR, '..', 'render.yaml'), 'utf8');
    const startCommand = renderYaml.match(/^\s*startCommand:\s*(.+)$/m)?.[1] ?? '';
    const packageJson = JSON.parse(fs.readFileSync(path.join(SERVER_DIR, 'package.json'), 'utf8'));

    expect(packageJson.scripts['db:deploy']).toBe('prisma migrate deploy');
    expect(startCommand).toMatch(/^npm run db:deploy --workspace=server && npm run start --workspace=server$/);
  });
});

describe('Row Level Security (Q42: Supabase Data API sees nothing)', () => {
  let db: PGlite;
  let prisma: PrismaClient;

  beforeAll(async () => {
    db = new PGlite();
    // Like Supabase: Prisma connects as a non-superuser role that owns the tables, while the
    // Data API reads as `anon`, which has SELECT grants on everything in `public`.
    await db.exec(`
      CREATE ROLE app_owner NOSUPERUSER;
      CREATE ROLE anon NOSUPERUSER;
      GRANT CREATE ON DATABASE postgres TO app_owner;
      GRANT CREATE, USAGE ON SCHEMA public TO app_owner;
      GRANT USAGE ON SCHEMA public TO anon;
      ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT SELECT ON TABLES TO anon;
      SET ROLE app_owner;
    `);
    await applyMigrations(db);
    prisma = new PrismaClient({ adapter: new PrismaPGlite(db) });
  }, 30_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.close();
  });

  it('is enabled on every table, including Prisma\'s _prisma_migrations', async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(`
      SELECT c.relname, c.relrowsecurity FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
       WHERE c.relkind IN ('r', 'p') ORDER BY c.relname`);

    expect(tables.rows.map((t) => t.relname)).toEqual(
      expect.arrayContaining(['_prisma_migrations', 'User', 'DirectMessage', 'Room', 'RoomMessage'])
    );
    expect(tables.rows.filter((t) => !t.relrowsecurity)).toEqual([]);
  });

  it('creates no policy, so a Data API role reads no rows', async () => {
    await prisma.user.create({
      data: { username: 'alice', usernameNormalized: 'alice', email: 'alice@example.com', passwordHash: 'hash' },
    });

    const policies = await db.query(`SELECT * FROM pg_policies WHERE schemaname = 'public'`);
    expect(policies.rows).toEqual([]);

    await db.exec('SET ROLE anon');
    try {
      const users = await db.query(`SELECT * FROM "User"`);
      const migrations = await db.query(`SELECT * FROM "_prisma_migrations"`);
      expect(users.rows).toEqual([]);
      expect(migrations.rows).toEqual([]);
    } finally {
      await db.exec('SET ROLE app_owner');
    }
  });

  it('still lets Prisma, connected as the table owner, read and write', async () => {
    const created = await prisma.user.create({
      data: { username: 'bob', usernameNormalized: 'bob', email: 'bob@example.com', passwordHash: 'hash' },
    });
    await prisma.user.update({ where: { id: created.id }, data: { isOnline: true } });

    const found = await prisma.user.findUnique({ where: { username: 'bob' } });
    expect(found?.isOnline).toBe(true);
  });
});
