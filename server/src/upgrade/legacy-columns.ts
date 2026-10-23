import type { UpgradeStepContext } from './runner.js';

// The contract migration (ticket 20) dropped the legacy columns from the Prisma schema, so the
// steps that still clean them up before it runs read and write them with raw SQL. Once the
// contract migration has dropped them, those steps find nothing to do.

/** Whether `table` still has the legacy `column` (false after the contract migration). */
export async function hasLegacyColumn(db: UpgradeStepContext['db'], table: string, column: string): Promise<boolean> {
  const rows = await db.$queryRaw<unknown[]>`
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column}`;
  return rows.length > 0;
}
