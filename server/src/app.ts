import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import directChatRoutes from './routes/direct-chat.routes.js';
import roomRoutes from './routes/room.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import gifRoutes from './routes/gif.routes.js';
import { UPLOADS_DIR, ensureUploadsDirExists } from './lib/storage.js';

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
