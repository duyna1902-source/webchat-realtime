import http from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import { registerDirectChatHandlers } from './direct.handler.js';
import { registerRoomHandlers } from './room.handler.js';
import { handleUserConnect, handleUserDisconnect } from './presence.handler.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function setupSocketServer(httpServer: http.Server): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });
  ioInstance = io;

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
      (decoded as any).id = decoded.userId;
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const authSocket = socket as AuthenticatedSocket;

    // Track user presence
    await handleUserConnect(io, authSocket);

    // Register direct chat events
    registerDirectChatHandlers(io, authSocket);
    // Register room chat events
    registerRoomHandlers(io, authSocket);

    // Client is successfully authenticated and connected
    socket.on('disconnect', () => {
      handleUserDisconnect(io, authSocket);
    });
  });

  return io;
}
