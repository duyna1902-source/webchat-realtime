import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createMigratedDatabase, describeSchema, listMigrations, SCHEMA_SQL_PATH } from './helpers/migrations.js';

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
