// Must stay the first import: loads `.env` into process.env before any other module runs.
import 'dotenv/config';
import { loadConfig, ConfigError } from '../config.js';
import { initPrisma } from '../lib/prisma.js';
import { createSessionStore } from '../lib/session-store.js';
import { runRevokeSessionsCommand } from '../lib/revoke-sessions-command.js';

// Incident response: `npm run sessions:revoke --workspace=server -- --user <username|id>` or `-- --all`.
// It revokes Sessions in whatever DATABASE_URL the configuration points at.
async function main() {
  const config = loadConfig(process.env);
  const prisma = await initPrisma(config.databaseUrl);
  const sessions = createSessionStore({
    prisma,
    idleTtlMs: config.timing.sessionIdleTtlMs,
    absoluteTtlMs: config.timing.sessionAbsoluteTtlMs,
    touchIntervalMs: config.timing.sessionTouchIntervalMs,
  });
  try {
    await runRevokeSessionsCommand(process.argv.slice(2), { prisma, sessions });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof ConfigError || err instanceof Error ? err.message : err);
  process.exit(1);
});
