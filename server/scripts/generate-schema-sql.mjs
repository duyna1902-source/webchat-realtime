#!/usr/bin/env node
// Regenerates prisma/schema.sql, the DDL that the tests load into in-memory PGlite, from
// prisma/schema.prisma with `prisma migrate diff --from-empty`. Offline: never connects to a database.
//
//   node scripts/generate-schema-sql.mjs          rewrite prisma/schema.sql
//   node scripts/generate-schema-sql.mjs --check  exit 1 if prisma/schema.sql is stale
//
// Production does not use this file: its schema comes from prisma/migrations via `prisma migrate deploy`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PRISMA = 'prisma/schema.prisma';
const SCHEMA_SQL = path.join(SERVER_DIR, 'prisma', 'schema.sql');

const HEADER = [
  '-- GENERATED FILE: DO NOT EDIT BY HAND.',
  '-- Regenerate after changing prisma/schema.prisma: npm run db:schema-sql --workspace=server',
  `-- Source: prisma migrate diff --from-empty --to-schema ${SCHEMA_PRISMA} --script`,
  '-- Loaded into in-memory PGlite by the tests. Production schema changes go through prisma/migrations.',
  '',
  '',
].join('\n');

function generate() {
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  const result = spawnSync(
    process.execPath,
    [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema', SCHEMA_PRISMA, '--script'],
    {
      cwd: SERVER_DIR,
      encoding: 'utf8',
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || String(result.error));
    throw new Error(`prisma migrate diff failed (exit ${result.status})`);
  }
  return HEADER + result.stdout.replace(/\r\n/g, '\n');
}

const check = process.argv.includes('--check');
const expected = generate();

if (check) {
  const current = fs.existsSync(SCHEMA_SQL) ? fs.readFileSync(SCHEMA_SQL, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== expected) {
    console.error('prisma/schema.sql is stale or was edited by hand. Run: npm run db:schema-sql --workspace=server');
    process.exit(1);
  }
  console.log('prisma/schema.sql is up to date.');
} else {
  fs.writeFileSync(SCHEMA_SQL, expected);
  console.log('Wrote prisma/schema.sql.');
}
