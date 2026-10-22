import path from 'node:path';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import directChatRoutes from './routes/direct-chat.routes.js';
import roomRoutes from './routes/room.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import gifRoutes from './routes/gif.routes.js';
import { UPLOADS_DIR, ensureUploadsDirExists } from './lib/storage.js';
import type { AppConfig } from './config.js';
import type { Logger } from './lib/logger.js';
import { requestContext } from './middlewares/request-id.js';
import { errorHandler } from './middlewares/error-handler.js';

/** Largest JSON body accepted; bigger bodies get `413`. */
export const JSON_BODY_LIMIT = '100kb';

/**
 * Builds the Express app for one server instance. Use `createServer()` rather than calling this
 * directly: it also attaches the server context (config, storage, Socket.IO) the handlers read.
 */
export function createApp(config: AppConfig, logger: Logger): express.Express {
  const app = express();

  app.use(requestContext(logger));
  app.use(cors());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Ensure uploads folder exists and serve statically
  ensureUploadsDirExists();
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/direct-chats', directChatRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/gifs', gifRoutes);

  // Serve built frontend if available (supports unified single-host deployment)
  const { clientDistPath } = config;
  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Global error handler: generic body with requestId, details only in the log
  app.use(errorHandler);

  return app;
}
