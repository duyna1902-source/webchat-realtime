import type { UpgradeStep } from './runner.js';
import { ACCOUNT_AND_ROOM_STEPS } from './account-room-steps.js';

/**
 * The data upgrade steps, run in this order by `npm run db:upgrade-data --workspace=server`.
 * Register each step here. It must be idempotent: a second run reports 0 changes.
 * See docs/database-migrations.md for where the command sits between expand and contract.
 */
export const UPGRADE_STEPS: readonly UpgradeStep[] = [...ACCOUNT_AND_ROOM_STEPS];
