import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import { getPrisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { socketHandler } from '../lib/async-handler.js';
import type { SocketRateLimits } from '../lib/rate-limit.js';
import type { Logger } from '../lib/logger.js';
import {
  SOCKET_EVENTS,
  RoomJoinPayload,
  RoomLeavePayload,
  RoomSendMessagePayload,
  RoomReceiveMessagePayload,
  RoomReadPayload,
  RoomTypingPayload,
  MessageType,
  MESSAGE_LIMITS,
  RoomRole,
  ERROR_CODES,
} from '@webchat/shared';

export async function autoJoinUserRooms(io: Server, socket: AuthenticatedSocket, log: Logger): Promise<void> {
  const userId = socket.data?.user?.userId;
  if (!userId) return;
  try {
    const prisma = getPrisma();
    const memberships = await prisma.roomMember.findMany({
      where: { userId },
      select: { roomId: true },
    });
    for (const m of memberships) {
      socket.join(`room:${m.roomId}`);
    }
  } catch (err) {
    log.error({ err }, 'Failed to auto-join user rooms');
  }
}

/**
 * Returns the `room:<id>` realtime rooms among `rooms` that the User is no longer a Room Member of.
 * Other rooms (`user:<id>`, the socket's own id) are never reported.
 */
export async function findRevokedRoomChannels(userId: string, rooms: Iterable<string>): Promise<Set<string>> {
  const roomIds = [...rooms].filter((r) => r.startsWith('room:')).map((r) => r.slice('room:'.length));
  if (roomIds.length === 0) return new Set();

  const prisma = getPrisma();
  const memberships = await prisma.roomMember.findMany({
    where: { userId, roomId: { in: roomIds } },
    select: { roomId: true },
  });
  const stillMember = new Set(memberships.map((m) => m.roomId));
  return new Set(roomIds.filter((id) => !stillMember.has(id)).map((id) => `room:${id}`));
}

export function syncUserSocketsRoomMembership(
  io: Server,
  userId: string,
  roomId: string,
  action: 'join' | 'leave'
): void {
  const targetRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
  if (targetRoom) {
    for (const socketId of targetRoom) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        if (action === 'join') {
          s.join(`room:${roomId}`);
        } else {
          s.leave(`room:${roomId}`);
        }
      }
    }
  }
}

export function registerRoomHandlers(io: Server, socket: AuthenticatedSocket, log: Logger, limits: SocketRateLimits): void {
  const userId = socket.data.user.userId;

  async function requireMember(roomId: string) {
    const member = await getPrisma().roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });
    if (!member) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Not a member of this room');
    }
    return member;
  }

  socket.on(
    SOCKET_EVENTS.ROOM_JOIN,
    socketHandler<RoomJoinPayload>(log, SOCKET_EVENTS.ROOM_JOIN, async (payload) => {
      const { roomId } = payload || ({} as RoomJoinPayload);
      if (!roomId) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'roomId is required');
      }

      await requireMember(roomId);

      socket.join(`room:${roomId}`);
      return { success: true };
    })
  );

  socket.on(
    SOCKET_EVENTS.ROOM_LEAVE,
    socketHandler<RoomLeavePayload>(log, SOCKET_EVENTS.ROOM_LEAVE, async (payload) => {
      const { roomId } = payload || ({} as RoomLeavePayload);
      if (roomId) {
        socket.leave(`room:${roomId}`);
      }
      return { success: true };
    })
  );

  socket.on(
    SOCKET_EVENTS.ROOM_SEND,
    socketHandler<RoomSendMessagePayload>(log, SOCKET_EVENTS.ROOM_SEND, async (payload) => {
      limits.consumeMessageSend();
      const { roomId, content, type, attachmentUrl, attachmentName, attachmentSize } = payload || ({} as RoomSendMessagePayload);
      if (!roomId || (!content && !attachmentUrl)) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'roomId and content or attachment are required');
      }

      const prisma = getPrisma();

      // Verify that user is a member of this room
      const member = await requireMember(roomId);

      const limit =
        member.role === RoomRole.OWNER || member.role === RoomRole.ADMIN
          ? MESSAGE_LIMITS.ROOM_LEADER
          : MESSAGE_LIMITS.ROOM_MEMBER;

      if (content && content.length > limit) {
        throw new AppError(400, ERROR_CODES.MESSAGE_TOO_LONG, `Message exceeds character limit of ${limit}`);
      }

      // Create RoomMessage in DB
      const message = await prisma.roomMessage.create({
        data: {
          roomId,
          senderId: userId,
          content: content || '',
          type: (type as any) || MessageType.TEXT,
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
          attachmentSize: attachmentSize || null,
        },
        include: {
          sender: true,
        },
      });

      // Update room updatedAt
      await prisma.room.update({
        where: { id: roomId },
        data: { updatedAt: new Date() },
      });

      const receivePayload: RoomReceiveMessagePayload = {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          avatarUrl: message.sender.avatarUrl,
        },
        content: message.content,
        type: message.type as MessageType,
        attachmentUrl: message.attachmentUrl,
        attachmentName: message.attachmentName,
        attachmentSize: message.attachmentSize,
        createdAt: message.createdAt.toISOString(),
      };

      // Broadcast to room
      io.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_RECEIVE, receivePayload);

      return { success: true, message: receivePayload };
    })
  );

  socket.on(
    SOCKET_EVENTS.ROOM_READ,
    socketHandler<{ roomId: string; messageId: string }>(log, SOCKET_EVENTS.ROOM_READ, async (payload) => {
      if (!payload || !payload.roomId || !payload.messageId) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'roomId and messageId are required');
      }

      const { roomId, messageId } = payload;
      const prisma = getPrisma();

      // Verify that user is a member of this room
      await requireMember(roomId);

      // Verify target message exists in this room
      const targetMessage = await prisma.roomMessage.findUnique({
        where: { id: messageId },
      });

      if (!targetMessage || targetMessage.roomId !== roomId) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Target message not found in this room');
      }

      // Update caller's RoomMember.lastReadMessageId
      await prisma.roomMember.update({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
        data: {
          lastReadMessageId: messageId,
        },
      });

      const readPayload: RoomReadPayload = {
        roomId,
        messageId,
        userId,
        readByUserId: userId,
      };

      // Broadcast room:read to room
      io.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_READ, readPayload);

      return { success: true, payload: readPayload };
    })
  );

  socket.on(
    SOCKET_EVENTS.ROOM_TYPING,
    socketHandler<RoomTypingPayload>(log, SOCKET_EVENTS.ROOM_TYPING, async (payload) => {
      const { roomId, isTyping } = payload || ({} as RoomTypingPayload);
      if (!roomId || typeof isTyping !== 'boolean') {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'roomId and isTyping are required');
      }
      // Over the limit: dropped silently (SEC-07).
      if (!limits.allowTyping(`room:${roomId}`, isTyping)) return;

      // Validate user is a member of the room
      await requireMember(roomId);

      const typingPayload: RoomTypingPayload = {
        roomId,
        userId: (socket.data.user as any).id || socket.data.user.userId,
        username: socket.data.user.username,
        isTyping,
      };

      // Broadcast room:typing to room
      socket.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_TYPING, typingPayload);

      return { success: true };
    })
  );
}
