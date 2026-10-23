// Must stay the first import: loads `.env` into process.env before any other module runs.
import 'dotenv/config';
import { loadConfig, ConfigError } from '../config.js';
import { initPrisma } from '../lib/prisma.js';
import { createStorageAdapter } from '../lib/storage.js';
import { runUpgradeCommand } from '../upgrade/runner.js';
import { upgradeSteps } from '../upgrade/steps.js';

// Data upgrade command: `npm run db:upgrade-data --workspace=server -- [--dry-run]`.
// It works on whatever DATABASE_URL and storage the configuration points at, so always
// start with --dry-run and read the report.
async function main() {
  const config = loadConfig(process.env);
  const prisma = await initPrisma(config.databaseUrl);
  const storage = createStorageAdapter(config.storage);
  try {
    await runUpgradeCommand(process.argv.slice(2), { prisma, storage, steps: upgradeSteps(config.storage) });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof ConfigError || err instanceof Error ? err.message : err);
  process.exit(1);
});
