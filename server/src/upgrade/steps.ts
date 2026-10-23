import type { StorageConfig } from '../config.js';
import type { UpgradeStep } from './runner.js';
import { ACCOUNT_AND_ROOM_STEPS } from './account-room-steps.js';
import { createAttachmentSteps } from './attachment-steps.js';

/**
 * The data upgrade steps, run in this order by `npm run db:upgrade-data --workspace=server`.
 * Register each step here. It must be idempotent: a second run reports 0 changes.
 * `storage` is the configured storage: legacy attachment URLs are matched against its bucket.
 * See docs/database-migrations.md for where the command sits between expand and contract.
 */
export function upgradeSteps(storage: StorageConfig): readonly UpgradeStep[] {
  return [...ACCOUNT_AND_ROOM_STEPS, ...createAttachmentSteps(storage)];
}
