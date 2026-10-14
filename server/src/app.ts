import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import directChatRoutes from './routes/direct-chat.routes.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/direct-chats', directChatRoutes);
