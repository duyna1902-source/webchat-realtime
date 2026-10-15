import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import directChatRoutes from './routes/direct-chat.routes.js';
import roomRoutes from './routes/room.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import gifRoutes from './routes/gif.routes.js';
import { UPLOADS_DIR, ensureUploadsDirExists } from './lib/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

export const app = express();

app.use(cors());
app.use(express.json());

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
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled application error:', err);
  res.status(500).json({ message: err?.message || 'Internal server error' });
});

