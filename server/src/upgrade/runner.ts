import type { Prisma, PrismaClient } from '@prisma/client';
import type { StorageAdapter } from '../lib/storage.js';

// ==========================================
// DATA UPGRADE COMMAND (seam test 3)
// ==========================================
// Runs the registered data-normalization steps between the expand and contract migrations.
// Every step runs inside ONE database transaction: a real run commits it, a dry run rolls it
// back. So a dry run executes the exact same code, its report reflects each step seeing the
// earlier steps' changes, and nothing is ever committed. Storage writes cannot be rolled back,
// so in a dry run they are skipped and listed in the report instead.

export interface UpgradeStepContext {
  /** Transaction client. Its writes are committed only by a real run where every step succeeds. */
  db: Prisma.TransactionClient;
  /** In a dry run, every method except the read-only ones is skipped (and returns undefined). */
  storage: StorageAdapter;
  dryRun: boolean;
}

export interface UpgradeStepOutcome {
  /** Number of rows or objects this step changed (or would change, in a dry run). */
  changed: number;
  /** Human-readable lines for the report, e.g. `old -> new`. */
  details?: string[];
}

/**
 * One data-normalization step. Steps must be idempotent: running the command a second time
 * finds nothing left to change and reports `changed: 0`.
 */
export interface UpgradeStep {
  name: string;
  run(ctx: UpgradeStepContext): Promise<UpgradeStepOutcome>;
}

export interface UpgradeStepReport {
  name: string;
  changed: number;
  details: string[];
  /** Storage methods a dry run skipped, in call order. Always empty in a real run. */
  skippedStorageWrites: string[];
}

export interface UpgradeReport {
  dryRun: boolean;
  steps: UpgradeStepReport[];
  totalChanged: number;
}

export interface RunDataUpgradeOptions {
  prisma: PrismaClient;
  storage: StorageAdapter;
  steps: readonly UpgradeStep[];
  dryRun: boolean;
  /** Upper bound for the whole run; the default suits a small production database. */
  transactionTimeoutMs?: number;
}

/** Storage methods that only read, so they also run in a dry run. Everything else is a write. */
const READ_ONLY_STORAGE_METHODS = new Set(['list', 'createSignedUrl', 'createSignedUrls']);

const DEFAULT_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000;

class DryRunRollback extends Error {
  constructor(readonly report: UpgradeReport) {
    super('Dry run: rolling back');
  }
}

function dryRunStorage(storage: StorageAdapter, skipped: string[]): StorageAdapter {
  return new Proxy(storage, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function' || typeof property !== 'string' || READ_ONLY_STORAGE_METHODS.has(property)) {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return async () => {
        skipped.push(property);
        return undefined;
      };
    },
  });
}

/** Runs `steps` in order inside one transaction and returns the report. */
export async function runDataUpgrade(options: RunDataUpgradeOptions): Promise<UpgradeReport> {
  const { prisma, storage, steps, dryRun } = options;
  const timeout = options.transactionTimeoutMs ?? DEFAULT_TRANSACTION_TIMEOUT_MS;

  const names = steps.map((step) => step.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) throw new Error(`Upgrade step "${duplicate}" is registered twice`);

  try {
    return await prisma.$transaction(
      async (db) => {
        const report: UpgradeReport = { dryRun, steps: [], totalChanged: 0 };
        for (const step of steps) {
          const skippedStorageWrites: string[] = [];
          const stepStorage = dryRun ? dryRunStorage(storage, skippedStorageWrites) : storage;
          const outcome = await step.run({ db, storage: stepStorage, dryRun });
          report.steps.push({
            name: step.name,
            changed: outcome.changed,
            details: outcome.details ?? [],
            skippedStorageWrites,
          });
          report.totalChanged += outcome.changed;
        }
        if (dryRun) throw new DryRunRollback(report);
        return report;
      },
      { maxWait: timeout, timeout }
    );
  } catch (err) {
    if (err instanceof DryRunRollback) return err.report;
    throw err;
  }
}

/** Plain-text summary printed by the command. */
export function formatUpgradeReport(report: UpgradeReport): string {
  const lines = [
    report.dryRun
      ? 'Data upgrade DRY RUN: nothing was written. This is what a real run would change:'
      : 'Data upgrade complete:',
  ];
  if (report.steps.length === 0) lines.push('  (no upgrade steps registered)');
  for (const step of report.steps) {
    lines.push(`  ${step.name}: ${step.changed} change${step.changed === 1 ? '' : 's'}`);
    lines.push(...step.details.map((detail) => `    ${detail}`));
    if (step.skippedStorageWrites.length > 0) {
      lines.push(`    skipped storage writes: ${step.skippedStorageWrites.join(', ')}`);
    }
  }
  lines.push(`Total: ${report.totalChanged} change${report.totalChanged === 1 ? '' : 's'}.`);
  return lines.join('\n');
}

export interface UpgradeCommandOptions {
  prisma: PrismaClient;
  storage: StorageAdapter;
  steps: readonly UpgradeStep[];
  log?: (line: string) => void;
}

const USAGE = 'Usage: upgrade-data [--dry-run]';

/** The command behind `npm run db:upgrade-data`: parses arguments, runs, prints the report. */
export async function runUpgradeCommand(argv: readonly string[], options: UpgradeCommandOptions): Promise<UpgradeReport> {
  const unknown = argv.filter((arg) => arg !== '--dry-run');
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(' ')}\n${USAGE}`);
  }
  const report = await runDataUpgrade({
    prisma: options.prisma,
    storage: options.storage,
    steps: options.steps,
    dryRun: argv.includes('--dry-run'),
  });
  (options.log ?? console.log)(formatUpgradeReport(report));
  return report;
}
