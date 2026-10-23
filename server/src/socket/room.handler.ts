import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import { getPrisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { socketHandler } from '../lib/async-handler.js';
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
  roomJoinSchema,
  roomLeaveSchema,
  roomSendSchema,
  roomReadSchema,
  roomTypingSchema,
} from '@webchat/shared';
import { parseInput } from '../lib/validation.js';
import {
  AttachmentSigner,
  findSendableAttachment,
  linkAttachment,
  messageTypeFor,
  signAttachments,
} from '../lib/attachments.js';
import { toRoomReceiveMessagePayload } from '../controllers/room.controller.js';

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

export function registerRoomHandlers(
  io: Server,
  socket: AuthenticatedSocket,
  log: Logger,
  signer: AttachmentSigner
): void {
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
      const { roomId } = parseInput(roomJoinSchema, payload);

      await requireMember(roomId);

      socket.join(`room:${roomId}`);
      return { success: true };
    })
  );

  socket.on(
    SOCKET_EVENTS.ROOM_LEAVE,
    socketHandler<RoomLeavePayload>(log, SOCKET_EVENTS.ROOM_LEAVE, async (payload) => {
      const { roomId } = parseInput(roomLeaveSchema, payload);
      socket.leave(`room:${roomId}`);
      return { success: true };
    })
  );

  socket.on(
    SOCKET_EVENTS.ROOM_SEND,
    socketHandler<RoomSendMessagePayload>(log, SOCKET_EVENTS.ROOM_SEND, async (payload) => {
      const { roomId, content, attachmentId, gifUrl } = parseInput(roomSendSchema, payload);

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

      // Create the RoomMessage; its type and file metadata come from the server, never the client.
      // A GIF travels in `content`, as before.
      const message = await prisma.$transaction(async (tx) => {
        const attachment = attachmentId ? await findSendableAttachment(tx, attachmentId, userId) : null;
        const created = await tx.roomMessage.create({
          data: {
            roomId,
            senderId: userId,
            content: gifUrl ?? content ?? '',
            type: gifUrl ? MessageType.EMOJI_GIF : attachment ? messageTypeFor(attachment.kind) : MessageType.TEXT,
          },
        });
        if (attachment) {
          await linkAttachment(tx, attachment.id, userId, { roomMessageId: created.id });
        }
        return tx.roomMessage.findUniqueOrThrow({
          where: { id: created.id },
          include: { sender: true, attachment: true },
        });
      });

      // Update room updatedAt
      await prisma.room.update({
        where: { id: roomId },
        data: { updatedAt: new Date() },
      });

      const receivePayload: RoomReceiveMessagePayload = toRoomReceiveMessagePayload(
        message,
        await signAttachments(signer, [message.attachment])
      );

      // Broadcast to room
      io.to(`room:${roomId}`).emit(SOCKET_EVENTS.ROOM_RECEIVE, receivePayload);

      return { success: true, message: receivePayload };
    })
  );

  socket.on(
    SOCKET_EVENTS.ROOM_READ,
    socketHandler<RoomReadPayload>(log, SOCKET_EVENTS.ROOM_READ, async (payload) => {
      const { roomId, messageId } = parseInput(roomReadSchema, payload);
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
      const { roomId, isTyping } = parseInput(roomTypingSchema, payload);

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
