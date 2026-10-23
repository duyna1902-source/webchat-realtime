import type { Request } from 'express';
import type { Server } from 'socket.io';
import type { AppConfig } from './config.js';
import type { StorageAdapter } from './lib/storage.js';
import type { AttachmentSigner } from './lib/attachments.js';
import type { SessionStore } from './lib/session-store.js';
import type { RestRateLimiters } from './middlewares/rate-limit.js';

/**
 * Dependencies of one server instance, built by the server factory and attached to its
 * Express app. Handlers read them from the request instead of from module-level globals.
 */
export interface ServerContext {
  config: AppConfig;
  storage: StorageAdapter;
  io: Server;
  sessions: SessionStore;
  /** This instance's REST rate limiters; use the `rateLimit(name)` route middleware. */
  rateLimiters: RestRateLimiters;
}

const CONTEXT_KEY = 'serverContext';

export function attachServerContext(locals: Record<string, any>, context: ServerContext): void {
  locals[CONTEXT_KEY] = context;
}

export function getServerContext(req: Request): ServerContext {
  const context = req.app.locals[CONTEXT_KEY] as ServerContext | undefined;
  if (!context) {
    throw new Error('Server context is missing. Build the server through createServer().');
  }
  return context;
}

/** Storage and TTL for signing the Attachments a request hands out. */
export function attachmentSigner(req: Request): AttachmentSigner {
  const { storage, config } = getServerContext(req);
  return { storage, ttlSeconds: config.timing.signedUrlTtlSeconds };
}
