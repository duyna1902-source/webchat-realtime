import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PRISMA_DIR = path.resolve(__dirname, '../../prisma');
export const MIGRATIONS_DIR = path.join(PRISMA_DIR, 'migrations');
export const SCHEMA_SQL_PATH = path.join(PRISMA_DIR, 'schema.sql');

/**
 * The last expand migration. The data upgrade command runs on a database migrated up to here;
 * the contract migration after it refuses to run until the command has normalized the data.
 */
export const LAST_EXPAND_MIGRATION = '20261026000000_expand_attachment_unavailable';

export interface Migration {
  name: string;
  sql: string;
}

/** Migrations in the order `prisma migrate deploy` applies them (directory name order). */
export function listMigrations(): Migration[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8') }));
}

// Same table `prisma migrate deploy` creates before it applies the first migration.
const PRISMA_MIGRATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);`;

export interface ApplyMigrationsOptions {
  /** Stop after this migration (inclusive), e.g. to load data between expand and contract. */
  until?: string;
}

/**
 * Applies pending migrations the way `prisma migrate deploy` does: creates `_prisma_migrations`,
 * runs each not-yet-applied `migration.sql` in name order, and records it. Returns the names applied.
 */
export async function applyMigrations(db: PGlite, options: ApplyMigrationsOptions = {}): Promise<string[]> {
  await db.exec(PRISMA_MIGRATIONS_TABLE_DDL);
  const done = await db.query<{ migration_name: string }>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
  );
  const alreadyApplied = new Set(done.rows.map((row) => row.migration_name));

  const applied: string[] = [];
  for (const migration of listMigrations()) {
    if (!alreadyApplied.has(migration.name)) {
      await db.transaction(async (tx) => {
        await tx.exec(migration.sql);
        await tx.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
           VALUES ($1, $2, now(), $3, 1)`,
          [crypto.randomUUID(), crypto.createHash('sha256').update(migration.sql).digest('hex'), migration.name]
        );
      });
      applied.push(migration.name);
    }
    if (migration.name === options.until) break;
  }
  return applied;
}

/** A fresh in-memory database with every migration applied. */
export async function createMigratedDatabase(options: ApplyMigrationsOptions = {}): Promise<PGlite> {
  const db = new PGlite();
  await applyMigrations(db, options);
  return db;
}

/**
 * A comparable description of the `public` schema: enums, columns, constraints and indexes.
 * Prisma's own `_prisma_migrations` table is left out.
 */
export async function describeSchema(db: PGlite): Promise<string[]> {
  const queries = [
    `SELECT 'enum ' || t.typname || ' ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS line
       FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
      GROUP BY t.typname`,
    `SELECT format('column %s.%s %s nullable=%s default=%s', table_name, column_name,
                   COALESCE(character_maximum_length::text, udt_name), is_nullable, column_default) AS line
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`,
    `SELECT format('constraint %s %s %s', c.conrelid::regclass, c.conname, pg_get_constraintdef(c.oid)) AS line
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace AND n.nspname = 'public'
      WHERE c.conrelid <> 0 AND c.conrelid::regclass::text <> '_prisma_migrations'`,
    `SELECT 'index ' || indexdef AS line FROM pg_indexes
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  ];
  const lines: string[] = [];
  for (const sql of queries) {
    const result = await db.query<{ line: string }>(sql);
    lines.push(...result.rows.map((row) => row.line));
  }
  return lines.sort();
}
