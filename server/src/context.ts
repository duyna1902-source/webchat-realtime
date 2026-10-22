import type { Request } from 'express';
import type { Server } from 'socket.io';
import type { AppConfig } from './config.js';
import type { StorageAdapter } from './lib/storage.js';

/**
 * Dependencies of one server instance, built by the server factory and attached to its
 * Express app. Handlers read them from the request instead of from module-level globals.
 */
export interface ServerContext {
  config: AppConfig;
  storage: StorageAdapter;
  io: Server;
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
