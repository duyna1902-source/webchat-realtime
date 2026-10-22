import http from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../lib/logger.js';
import { registerDirectChatHandlers, handleDirectMessagesDeliveryOnConnect } from './direct.handler.js';
import { registerRoomHandlers, autoJoinUserRooms } from './room.handler.js';
import { handleUserConnect, handleUserDisconnect } from './presence.handler.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

/** 64KB: comfortably above the largest valid event (a 4000-character message). */
export const SOCKET_MAX_HTTP_BUFFER_SIZE = 64 * 1024;

export function setupSocketServer(httpServer: http.Server, config: AppConfig, logger: Logger): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    // Largest accepted packet; a bigger one closes the connection (A24, SEC-05).
    maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_SIZE,
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
    const log = logger.child({ userId: authSocket.data.user.userId, socketId: socket.id, ip: socket.handshake.address });

    // Registered first so presence is cleaned up even if the setup below fails.
    socket.on('disconnect', () => {
      handleUserDisconnect(io, authSocket, config.timing.presenceGracePeriodMs);
    });

    try {
      // Track user presence
      await handleUserConnect(io, authSocket);

      // Auto-deliver any pending direct messages sent to this user while offline
      if (authSocket.data?.user?.userId) {
        await handleDirectMessagesDeliveryOnConnect(io, authSocket.data.user.userId, log);
      }

      // Register direct chat events
      registerDirectChatHandlers(io, authSocket, log);
      // Register room chat events
      registerRoomHandlers(io, authSocket, log);
      // Automatically subscribe to user's rooms in the background
      await autoJoinUserRooms(io, authSocket, log);
    } catch (err) {
      // A half-set-up connection is worse than none: log it and let the client reconnect.
      log.error({ err }, 'Socket connection setup failed');
      socket.disconnect(true);
    }
  });

  return io;
}
