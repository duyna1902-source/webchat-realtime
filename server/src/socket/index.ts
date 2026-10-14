import http from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import { registerDirectChatHandlers } from './direct.handler.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

export function setupSocketServer(httpServer: http.Server): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // JWT Authentication Middleware for Socket.io
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = verifyToken(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    // Register direct chat events
    registerDirectChatHandlers(io, authSocket);

    // Client is successfully authenticated and connected
    socket.on('disconnect', () => {
      // Handled in presence module in upcoming tickets
    });
  });

  return io;
}
