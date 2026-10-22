import { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, AppConfig, RateLimitsConfig, TimingConfig } from '../../src/config.js';
import { createServer, WebchatServer } from '../../src/server.js';
import { InMemoryStorageAdapter, StorageAdapter } from '../../src/lib/storage.js';
import { signToken, JwtPayload } from '../../src/lib/jwt.js';
import type { Logger } from '../../src/lib/logger.js';

export const TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
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
      JWT_SECRET: TEST_JWT_SECRET,
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
  /** Listen on a random port (needed for socket.io-client). Supertest works without it. */
  listen?: boolean;
}

/** Builds a server through the production factory, with test config and in-memory storage. */
export async function createTestServer<S extends StorageAdapter = InMemoryStorageAdapter>(
  options: CreateTestServerOptions<S> = {}
): Promise<TestServer<S>> {
  const config = createTestConfig(options.config);
  const storage = (options.storage ?? new InMemoryStorageAdapter()) as S;
  const server = await createServer({ config, storage, logger: options.logger });

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

/** Signs a token the way the server does under the default test configuration. */
export function generateToken(payload: JwtPayload): string {
  return signToken(payload, TEST_JWT_SECRET);
}
