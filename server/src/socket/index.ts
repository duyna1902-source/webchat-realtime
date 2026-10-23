import http from 'http';
import { Server, Socket } from 'socket.io';
import type { AppConfig } from '../config.js';
import type { Logger } from '../lib/logger.js';
import type { StorageAdapter } from '../lib/storage.js';
import type { AttachmentSigner } from '../lib/attachments.js';
import type { SessionStore } from '../lib/session-store.js';
import { readSessionToken } from '../lib/session-cookie.js';
import { createSocketRateLimiter } from '../lib/rate-limit.js';
import { SOCKET_EVENTS } from '@webchat/shared';
import { registerDirectChatHandlers, handleDirectMessagesDeliveryOnConnect } from './direct.handler.js';
import { registerRoomHandlers, autoJoinUserRooms, findRevokedRoomChannels } from './room.handler.js';
import { handleUserConnect, handleUserDisconnect } from './presence.handler.js';

/** The User a socket acts as, set by the handshake from its Session. */
export interface SocketUser {
  userId: string;
  username: string;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user: SocketUser;
    sessionId: string;
  };
}

export interface SocketServerDeps {
  config: AppConfig;
  logger: Logger;
  sessions: SessionStore;
  /** Signs the Attachments of the messages sockets send out. */
  storage: StorageAdapter;
}

/** Internal room holding every socket of one Session, so they can be cut off together. */
export function sessionChannel(sessionId: string): string {
  return `session:${sessionId}`;
}

/** 64KB: comfortably above the largest valid event (a 4000-character message). */
export const SOCKET_MAX_HTTP_BUFFER_SIZE = 64 * 1024;

export function setupSocketServer(httpServer: http.Server, { config, logger, sessions, storage }: SocketServerDeps): Server {
  const signer: AttachmentSigner = { storage, ttlSeconds: config.timing.signedUrlTtlSeconds };
  // No `cors` option: the client is served from the same origin (ADR 0010).
  const io = new Server(httpServer, {
    transports: ['websocket', 'polling'],
    // Largest accepted packet; a bigger one closes the connection (A24, SEC-05).
    maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_SIZE,
    connectionStateRecovery: {
      maxDisconnectionDuration: config.timing.connectionStateRecoveryMs,
      // A recovered socket goes through the handshake checks again (Origin and Session).
      skipMiddlewares: false,
    },
  });
  reconcileRoomMembershipOnRecovery(io);
  const rateLimiter = createSocketRateLimiter(config.rateLimits);

  // Handshake: same-origin only (no Cross-Site WebSocket Hijacking), then the Session cookie.
  io.use(async (socket, next) => {
    if (socket.handshake.headers.origin !== config.appOrigin) {
      return next(new Error('Forbidden origin'));
    }

    let resolved;
    try {
      resolved = await sessions.resolve(readSessionToken(socket.handshake.headers.cookie));
    } catch (err) {
      logger.error({ err, socketId: socket.id }, 'Socket handshake failed');
      return next(new Error('Authentication failed'));
    }
    if (!resolved) {
      return next(new Error('Authentication required'));
    }

    socket.data.user = { userId: resolved.user.id, username: resolved.user.username };
    socket.data.sessionId = resolved.session.id;
    next();
  });

  io.on('connection', async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const log = logger.child({ userId: authSocket.data.user.userId, socketId: socket.id, ip: socket.handshake.address });
    socket.join(sessionChannel(authSocket.data.sessionId));
    const limits = rateLimiter.forSocket(authSocket.data.user.userId, log);

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
      registerDirectChatHandlers(io, authSocket, log, limits, signer);
      // Register room chat events
      registerRoomHandlers(io, authSocket, log, limits, signer);
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
