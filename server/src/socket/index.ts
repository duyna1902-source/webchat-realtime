import http from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import type { AppConfig } from '../config.js';
import { registerDirectChatHandlers, handleDirectMessagesDeliveryOnConnect } from './direct.handler.js';
import { registerRoomHandlers, autoJoinUserRooms } from './room.handler.js';
import { handleUserConnect, handleUserDisconnect } from './presence.handler.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

export function setupSocketServer(httpServer: http.Server, config: AppConfig): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    connectionStateRecovery: {
      maxDisconnectionDuration: config.timing.connectionStateRecoveryMs,
      skipMiddlewares: true,
    },
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
      const decoded = verifyToken(token, config.jwtSecret);
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

    // Auto-deliver any pending direct messages sent to this user while offline
    if (authSocket.data?.user?.userId) {
      await handleDirectMessagesDeliveryOnConnect(io, authSocket.data.user.userId);
    }

    // Register direct chat events
    registerDirectChatHandlers(io, authSocket);
    // Register room chat events
    registerRoomHandlers(io, authSocket);
    // Automatically subscribe to user's rooms in the background
    await autoJoinUserRooms(io, authSocket);

    // Client is successfully authenticated and connected
    socket.on('disconnect', () => {
      handleUserDisconnect(io, authSocket, config.timing.presenceGracePeriodMs);
    });
  });

  return io;
}
