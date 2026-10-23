import type { PrismaClient } from '@prisma/client';
import type { SessionStore } from './session-store.js';

// ==========================================
// REVOKE SESSIONS COMMAND (incident response)
// ==========================================
// `npm run sessions:revoke --workspace=server -- --user <username|id>` signs one User out on every
// device; `-- --all` signs everybody out. It works on whatever DATABASE_URL the configuration points
// at. A running server cuts off the open sockets of the revoked Sessions at its next re-check
// (`timing.sessionRecheckIntervalMs`).

export interface RevokeSessionsCommandOptions {
  prisma: PrismaClient;
  sessions: SessionStore;
  log?: (line: string) => void;
}

export interface RevokeSessionsResult {
  revoked: number;
}

const USAGE = 'Usage: revoke-sessions --user <username|id> | --all';

type Target = { kind: 'user'; login: string } | { kind: 'all' };

function parseArguments(argv: readonly string[]): Target {
  if (argv.length === 1 && argv[0] === '--all') return { kind: 'all' };
  if (argv.length === 2 && argv[0] === '--user' && argv[1] && !argv[1].startsWith('--')) {
    return { kind: 'user', login: argv[1] };
  }
  throw new Error(`Invalid arguments: ${argv.join(' ') || '(none)'}\n${USAGE}`);
}

const plural = (count: number) => `${count} session${count === 1 ? '' : 's'}`;

/** The command behind `npm run sessions:revoke`: parses arguments, revokes, prints the count. */
export async function runRevokeSessionsCommand(
  argv: readonly string[],
  { prisma, sessions, log = console.log }: RevokeSessionsCommandOptions
): Promise<RevokeSessionsResult> {
  const target = parseArguments(argv);

  if (target.kind === 'all') {
    const revoked = await sessions.revokeAll();
    log(`Revoked ${plural(revoked)} of all users.`);
    return { revoked };
  }

  // Exact id or exact username: an operator must not sign out the wrong User by a near match.
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: target.login }, { username: target.login }] },
    select: { id: true, username: true },
  });
  if (!user) {
    throw new Error(`No user with id or username "${target.login}". Nothing was revoked.`);
  }

  const revoked = await sessions.revokeAllForUser(user.id);
  log(`Revoked ${plural(revoked)} of user ${user.username} (${user.id}).`);
  return { revoked };
}
