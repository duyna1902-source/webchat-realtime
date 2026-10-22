import http from 'node:http';
import type { Express } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { AppConfig } from './config.js';
import type { StorageAdapter } from './lib/storage.js';
import { initPrisma } from './lib/prisma.js';
import { setupSocketServer } from './socket/index.js';
import { createApp } from './app.js';
import { attachServerContext } from './context.js';
import { createLogger, Logger } from './lib/logger.js';
import { createSessionStore, SessionStore } from './lib/session-store.js';

export interface CreateServerOptions {
  /** Validated configuration from `loadConfig()`. */
  config: AppConfig;
  storage: StorageAdapter;
  /** Defaults to a JSON logger on stdout at `config.logLevel`. */
  logger?: Logger;
}

export interface WebchatServer {
  /** HTTP server with Express and Socket.IO attached; not yet listening. */
  httpServer: http.Server;
  app: Express;
  io: SocketServer;
  logger: Logger;
  sessions: SessionStore;
}

/**
 * Server factory: the single way to build the server, in production and in tests.
 * Connects the database, then wires Express and Socket.IO onto one HTTP server.
 */
export async function createServer({ config, storage, logger: injectedLogger }: CreateServerOptions): Promise<WebchatServer> {
  const logger = injectedLogger ?? createLogger({ level: config.logLevel });
  const prisma = await initPrisma(config.databaseUrl);
  const sessions = createSessionStore({
    prisma,
    idleTtlMs: config.timing.sessionIdleTtlMs,
    absoluteTtlMs: config.timing.sessionAbsoluteTtlMs,
    touchIntervalMs: config.timing.sessionTouchIntervalMs,
  });

  const app = createApp(config, logger);
  const httpServer = http.createServer(app);
  // Socket.IO must attach after Express so it can intercept `/socket.io` requests first.
  const io = setupSocketServer(httpServer, { config, logger, sessions });
  attachServerContext(app.locals, { config, storage, io, sessions });

  return { httpServer, app, io, logger, sessions };
}
