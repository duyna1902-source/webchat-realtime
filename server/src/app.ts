import path from 'node:path';
import express from 'express';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import directChatRoutes from './routes/direct-chat.routes.js';
import roomRoutes from './routes/room.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import attachmentRoutes from './routes/attachment.routes.js';
import gifRoutes from './routes/gif.routes.js';
import type { StorageAdapter } from './lib/storage.js';
import { securityHeaders } from './middlewares/security-headers.js';
import type { AppConfig } from './config.js';
import type { Logger } from './lib/logger.js';
import { requestContext } from './middlewares/request-id.js';
import { errorHandler } from './middlewares/error-handler.js';
import { requireSameOrigin } from './middlewares/origin-check.js';
import { logRefusedRequests } from './middlewares/refused-request-log.js';

/** Largest JSON body accepted; bigger bodies get `413`. */
export const JSON_BODY_LIMIT = '100kb';

const SERVER_OWNED_PATH_PREFIXES = ['/api', '/socket.io', '/health', '/uploads'];

/** True for `/api`, `/api/...` and the like, but not for SPA routes such as `/apiary`. */
function isServerOwnedPath(requestPath: string): boolean {
  return SERVER_OWNED_PATH_PREFIXES.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`));
}

export interface AppHealthChecks {
  /** Rejects when the database cannot be queried; `/health/ready` then answers `503`. */
  checkDatabase: () => Promise<unknown>;
}

/**
 * Builds the Express app for one server instance. Use `createServer()` rather than calling this
 * directly: it also attaches the server context (config, storage, Socket.IO) the handlers read.
 */
export function createApp(
  config: AppConfig,
  logger: Logger,
  storage: StorageAdapter,
  { checkDatabase }: AppHealthChecks
): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // Render puts exactly one proxy in front of the app: trust its X-Forwarded-For so `req.ip`
  // is the real client IP, for rate limiting and logs.
  app.set('trust proxy', 1);

  // Single-host, same-origin app (ADR 0010): no CORS. Security headers go first so every response has them.
  app.use(securityHeaders(config));
  app.use(requestContext(logger));
  app.use(logRefusedRequests);
  // Before any body parsing: a cross-site write is refused without reading its body.
  app.use(requireSameOrigin(config.appOrigin));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Files of the local adapter (dev and test only), served as downloads. Other adapters serve their own.
  if (storage.createRequestHandler) {
    app.use('/uploads', storage.createRequestHandler());
  }

  // Liveness: the process is up and answering.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Readiness: the database answers too. The reason for a failure goes only to the log.
  app.get('/health/ready', (req, res) => {
    checkDatabase().then(
      () => res.json({ status: 'ready', timestamp: new Date().toISOString() }),
      (err: unknown) => {
        req.log.error({ err }, 'Readiness check failed: database unreachable');
        res.status(503).json({ status: 'unavailable', timestamp: new Date().toISOString() });
      }
    );
  });

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/direct-chats', directChatRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/attachments', attachmentRoutes);
  app.use('/api/gifs', gifRoutes);

  // Serve built frontend if available (supports unified single-host deployment)
  const { clientDistPath } = config;
  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    // `index.html` fallback for client-side routes: only GET, and never for server-owned paths.
    app.get('*', (req, res, next) => {
      if (isServerOwnedPath(req.path)) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Global error handler: generic body with requestId, details only in the log
  app.use(errorHandler);

  return app;
}
