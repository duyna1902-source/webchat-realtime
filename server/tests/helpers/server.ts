import http from 'node:http';
import { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Express } from 'express';
import type { Prisma, User } from '@prisma/client';
import { normalizeUsername } from '@webchat/shared';
import { loadConfig, AppConfig, RateLimitsConfig, TimingConfig } from '../../src/config.js';
import { createServer, WebchatServer } from '../../src/server.js';
import { InMemoryStorageAdapter, StorageAdapter } from '../../src/lib/storage.js';
import type { Logger } from '../../src/lib/logger.js';
import { getPrisma } from '../../src/lib/prisma.js';
import { SESSION_COOKIE_NAME } from '../../src/lib/session-cookie.js';

export const TEST_APP_ORIGIN = 'http://localhost:5173';

export interface TestConfigOverrides extends Partial<Omit<AppConfig, 'rateLimits' | 'timing'>> {
  rateLimits?: Partial<RateLimitsConfig>;
  timing?: Partial<TimingConfig>;
}

/** Validated test configuration (PGlite in-memory, no client build), with per-test overrides. */
export function createTestConfig(overrides: TestConfigOverrides = {}): AppConfig {
  const base = loadConfig(
    {
      NODE_ENV: 'test',
      DATABASE_URL: 'memory:',
      APP_ORIGIN: TEST_APP_ORIGIN,
    },
    { clientDistPath: path.join(os.tmpdir(), 'webchat-test-no-client-build') }
  );
  const { rateLimits, timing, ...rest } = overrides;
  return {
    ...base,
    // Quiet by default; tests that inspect logs inject their own logger with a sink.
    logLevel: 'silent',
    ...rest,
    rateLimits: { ...base.rateLimits, ...rateLimits },
    timing: { ...base.timing, ...timing },
  };
}

export interface TestServer<S extends StorageAdapter = StorageAdapter> extends WebchatServer {
  config: AppConfig;
  storage: S;
  /** Port the HTTP server listens on (0 until `listen` is requested). */
  port: number;
  close(): Promise<void>;
}

export interface CreateTestServerOptions<S extends StorageAdapter> {
  config?: TestConfigOverrides;
  storage?: S;
  /** Logger to build the server with, e.g. one writing to a test sink. */
  logger?: Logger;
  /** Replaces the database readiness probe of `/health/ready`, e.g. with a failing one. */
  checkDatabase?: () => Promise<unknown>;
  /** Listen on a random port (needed for socket.io-client). Supertest works without it. */
  listen?: boolean;
}

/** Builds a server through the production factory, with test config and in-memory storage. */
export async function createTestServer<S extends StorageAdapter = InMemoryStorageAdapter>(
  options: CreateTestServerOptions<S> = {}
): Promise<TestServer<S>> {
  const config = createTestConfig(options.config);
  const storage = (options.storage ?? new InMemoryStorageAdapter()) as S;
  const server = await createServer({ config, storage, logger: options.logger, checkDatabase: options.checkDatabase });

  let port = 0;
  if (options.listen) {
    await new Promise<void>((resolve) => server.httpServer.listen(0, () => resolve()));
    port = (server.httpServer.address() as AddressInfo).port;
  }

  return {
    ...server,
    config,
    storage,
    port,
    close: () => new Promise<void>((resolve) => server.io.close(() => resolve())),
  };
}

// ==========================================
// LOGGED-IN USERS
// ==========================================
// Tests log in the way a browser does: POST /api/auth/login, keep the `__Host-session` cookie,
// and send it back with the app's `Origin`. Over plain http a cookie jar would drop the Secure
// cookie, so the helpers pass the headers by hand.

export const TEST_PASSWORD = 'test-password-123';
// Low bcrypt cost: the real login check runs, just faster.
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

/** What a same-origin browser sends: the Session cookie and the app's Origin. */
export interface SessionHeaders {
  Cookie: string;
  Origin: string;
  [header: string]: string;
}

/** Anything supertest can send requests to. */
export type RequestTarget = Express | http.Server;

/** The `__Host-session=<token>` pair from a response's Set-Cookie, ready for a `Cookie` header. */
export function sessionCookieOf(res: { headers: Record<string, unknown> }): string {
  const lines = ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []);
  const line = lines.find((candidate) => candidate.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!line) throw new Error('Response did not set the Session cookie');
  return line.split(';')[0];
}

export function sessionHeaders(cookie: string): SessionHeaders {
  return { Cookie: cookie, Origin: TEST_APP_ORIGIN };
}

/**
 * Logs an existing User in through `POST /api/auth/login` and returns the headers of the new
 * Session. The User's password is set to `TEST_PASSWORD` first, so users seeded straight into
 * the DB can log in too.
 */
export async function loginAs(target: RequestTarget, user: Pick<User, 'id' | 'username'>): Promise<SessionHeaders> {
  await getPrisma().user.update({ where: { id: user.id }, data: { passwordHash: TEST_PASSWORD_HASH } });
  const res = await request(target)
    .post('/api/auth/login')
    .set('Origin', TEST_APP_ORIGIN)
    .send({ emailOrUsername: user.username, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Login as ${user.username} failed with ${res.status}`);
  }
  return sessionHeaders(sessionCookieOf(res));
}

export interface LoggedInUser {
  user: User;
  headers: SessionHeaders;
}

/** Creates a User (email defaults to `<username>@example.com`) and logs them in. */
export async function createLoggedInUser(
  target: RequestTarget,
  data: Pick<Prisma.UserCreateInput, 'username'> & Partial<Omit<Prisma.UserCreateInput, 'passwordHash'>>
): Promise<LoggedInUser> {
  const user = await getPrisma().user.create({
    data: {
      email: `${data.username}@example.com`,
      usernameNormalized: normalizeUsername(data.username),
      ...data,
      passwordHash: TEST_PASSWORD_HASH,
    },
  });
  return { user, headers: await loginAs(target, user) };
}
