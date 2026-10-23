import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { PrismaClient } from '@prisma/client';

// ==========================================
// SESSION STORE (ADR 0010)
// ==========================================
// A Session is a row in the DB, found by the SHA-256 of a random token. The raw token exists only
// in the browser's HttpOnly cookie and, once, in the return value of `create()`. It is never stored
// or logged. Revoking a Session deletes its row.
//
// Every revocation is announced as a `SessionRevocation` event so the socket layer can cut off the
// sockets of the revoked Sessions at once (Q45). Events are in-process only: a revocation made by
// another process (the operator CLI) is picked up by `findActive`, which the socket layer polls.

/** 32 bytes from the CSPRNG. */
const TOKEN_BYTES = 32;

export interface SessionClientInfo {
  ip?: string | null;
  userAgent?: string | null;
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  isOnline: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActiveSession {
  id: string;
  userId: string;
  createdAt: Date;
  lastActiveAt: Date;
  /** Absolute expiry. */
  expiresAt: Date;
}

export interface ResolvedSession {
  session: ActiveSession;
  user: SessionUser;
}

/** What a revocation covered: one Session, every Session of one User, or every Session. */
export type SessionRevocation =
  | { scope: 'session'; sessionId: string }
  | { scope: 'user'; userId: string }
  | { scope: 'all' };

export type SessionRevocationListener = (revocation: SessionRevocation) => void;

export interface SessionStore {
  /** Starts a Session for the User and returns its raw token. This is the only time it is available. */
  create(userId: string, client?: SessionClientInfo): Promise<string>;
  /** The Session and its User, or null when the token is unknown, expired or revoked. */
  resolve(rawToken: string | null | undefined): Promise<ResolvedSession | null>;
  /** Ends one Session. Unknown ids are ignored. */
  revoke(sessionId: string): Promise<void>;
  /** Ends every Session of the User ("log out everywhere") and returns how many there were. */
  revokeAllForUser(userId: string): Promise<number>;
  /** Ends every Session of every User (incident response) and returns how many there were. */
  revokeAll(): Promise<number>;
  /** The ids among `sessionIds` whose Session still exists and has not reached its absolute expiry. */
  findActive(sessionIds: readonly string[]): Promise<Set<string>>;
  /** Called after each revocation that ended at least one Session. Returns an unsubscribe function. */
  onRevoked(listener: SessionRevocationListener): () => void;
}

export interface SessionStoreOptions {
  prisma: PrismaClient;
  /** Inactivity after which a Session expires (7 days). */
  idleTtlMs: number;
  /** Lifetime counted from creation, whatever the activity (30 days). */
  absoluteTtlMs: number;
  /** `lastActiveAt` is written at most once per this interval, not on every request. */
  touchIntervalMs: number;
  /** Clock, overridable for tests. */
  now?: () => number;
}

/** Longest `User-Agent` kept; the header is client-controlled. */
const MAX_USER_AGENT_LENGTH = 512;

export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function createSessionStore(options: SessionStoreOptions): SessionStore {
  const { prisma, idleTtlMs, absoluteTtlMs, touchIntervalMs } = options;
  const now = options.now ?? (() => Date.now());
  const events = new EventEmitter();
  const REVOKED = 'revoked';

  function announce(count: number, revocation: SessionRevocation): number {
    if (count > 0) events.emit(REVOKED, revocation);
    return count;
  }

  return {
    async create(userId, client = {}) {
      const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
      const createdAt = new Date(now());
      await prisma.session.create({
        data: {
          userId,
          tokenHash: hashSessionToken(rawToken),
          createdAt,
          lastActiveAt: createdAt,
          expiresAt: new Date(createdAt.getTime() + absoluteTtlMs),
          ip: client.ip ?? null,
          userAgent: client.userAgent ? client.userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
        },
      });
      return rawToken;
    },

    async resolve(rawToken) {
      if (typeof rawToken !== 'string' || rawToken.length === 0) return null;

      const row = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(rawToken) },
        include: { user: { omit: { passwordHash: true } } },
      });
      if (!row) return null;

      const current = now();
      const idleExpired = current - row.lastActiveAt.getTime() >= idleTtlMs;
      const absoluteExpired = current >= row.expiresAt.getTime();
      if (idleExpired || absoluteExpired) {
        await prisma.session.deleteMany({ where: { id: row.id } });
        return null;
      }

      let lastActiveAt = row.lastActiveAt;
      if (current - row.lastActiveAt.getTime() >= touchIntervalMs) {
        lastActiveAt = new Date(current);
        await prisma.session.updateMany({ where: { id: row.id }, data: { lastActiveAt } });
      }

      const { user, ...session } = row;
      return {
        session: {
          id: session.id,
          userId: session.userId,
          createdAt: session.createdAt,
          lastActiveAt,
          expiresAt: session.expiresAt,
        },
        user,
      };
    },

    async revoke(sessionId) {
      const { count } = await prisma.session.deleteMany({ where: { id: sessionId } });
      announce(count, { scope: 'session', sessionId });
    },

    async revokeAllForUser(userId) {
      const { count } = await prisma.session.deleteMany({ where: { userId } });
      return announce(count, { scope: 'user', userId });
    },

    async revokeAll() {
      const { count } = await prisma.session.deleteMany({});
      return announce(count, { scope: 'all' });
    },

    async findActive(sessionIds) {
      if (sessionIds.length === 0) return new Set();
      const rows = await prisma.session.findMany({
        where: { id: { in: [...sessionIds] }, expiresAt: { gt: new Date(now()) } },
        select: { id: true },
      });
      return new Set(rows.map((row) => row.id));
    },

    onRevoked(listener) {
      events.on(REVOKED, listener);
      return () => {
        events.off(REVOKED, listener);
      };
    },
  };
}
