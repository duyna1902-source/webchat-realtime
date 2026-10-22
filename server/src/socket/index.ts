import http from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import type { AppConfig } from '../config.js';
import { SOCKET_EVENTS } from '@webchat/shared';
import { registerDirectChatHandlers, handleDirectMessagesDeliveryOnConnect } from './direct.handler.js';
import { registerRoomHandlers, autoJoinUserRooms, findRevokedRoomChannels } from './room.handler.js';
import { handleUserConnect, handleUserDisconnect } from './presence.handler.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

export function setupSocketServer(httpServer: http.Server, config: AppConfig): Server {
  // No `cors` option: the client is served from the same origin (ADR 0010).
  const io = new Server(httpServer, {
    transports: ['websocket', 'polling'],
    connectionStateRecovery: {
      maxDisconnectionDuration: config.timing.connectionStateRecoveryMs,
      skipMiddlewares: true,
    },
  });
  reconcileRoomMembershipOnRecovery(io);

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

/**
 * Connection State Recovery restores packets, not rights (SEC-06). Before a recovered socket is
 * built, its saved `room:<id>` rooms are checked against Room Membership in the DB: rooms the User
 * was removed from while offline are dropped, together with the missed packets of those rooms.
 * The socket therefore never rejoins a revoked room, not even for one event.
 * If the check throws, Socket.IO falls back to a fresh, unrecovered connection.
 */
function reconcileRoomMembershipOnRecovery(io: Server): void {
  const adapter = io.of('/').adapter;
  const restoreSession = adapter.restoreSession.bind(adapter);

  adapter.restoreSession = async (pid, offset) => {
    const session = await restoreSession(pid, offset);
    if (!session) return session;

    const userId = (session.data as Partial<AuthenticatedSocket['data']> | undefined)?.user?.userId;
    if (!userId) return session;

    const revoked = await findRevokedRoomChannels(userId, session.rooms);
    if (revoked.size === 0) return session;

    return {
      ...session,
      rooms: session.rooms.filter((room) => !revoked.has(room)),
      missedPackets: session.missedPackets.filter((packet) => !isPacketForRevokedRoom(packet, revoked, userId)),
    };
  };
}

/**
 * Missed packets keep only `[event, payload]`; room events carry their room in `payload.roomId`.
 * The User's own membership change (e.g. the KICK notice) is kept so the client learns about it.
 */
function isPacketForRevokedRoom(packet: unknown, revoked: Set<string>, userId: string): boolean {
  if (!Array.isArray(packet)) return false;
  const [event, payload] = packet as [unknown, { roomId?: unknown; userId?: unknown } | undefined];
  if (typeof event !== 'string' || !ROOM_SCOPED_EVENTS.has(event)) return false;
  if (typeof payload?.roomId !== 'string' || !revoked.has(`room:${payload.roomId}`)) return false;
  return !(event === SOCKET_EVENTS.ROOM_MEMBER_CHANGE && payload.userId === userId);
}

const ROOM_SCOPED_EVENTS: ReadonlySet<string> = new Set([
  SOCKET_EVENTS.ROOM_RECEIVE,
  SOCKET_EVENTS.ROOM_TYPING,
  SOCKET_EVENTS.ROOM_READ,
  SOCKET_EVENTS.ROOM_MEMBER_CHANGE,
]);
