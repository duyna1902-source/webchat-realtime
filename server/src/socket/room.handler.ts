import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import { getPrisma } from '../lib/prisma.js';
import {
  SOCKET_EVENTS,
  RoomJoinPayload,
  RoomLeavePayload,
  RoomSendMessagePayload,
  RoomReceiveMessagePayload,
  RoomReadPayload,
  MessageType,
} from '@webchat/shared';

export function registerRoomHandlers(io: Server, socket: AuthenticatedSocket): void {
  const userId = socket.data.user.userId;

  socket.on(SOCKET_EVENTS.ROOM_JOIN, async (payload: RoomJoinPayload, callback?: (res: any) => void) => {
    try {
      const { roomId } = payload || {};
      if (!roomId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'roomId is required' });
        }
        return;
      }

      const prisma = getPrisma();
      const member = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
      });

      if (!member) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Not a member of this room' });
        }
        return;
      }

      socket.join(`room:${roomId}`);
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err: any) {
      console.error('Error handling room:join:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Internal server error' });
      }
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, async (payload: RoomLeavePayload, callback?: (res: any) => void) => {
    try {
      const { roomId } = payload || {};
      if (roomId) {
        socket.leave(`room:${roomId}`);
      }
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err: any) {
      console.error('Error handling room:leave:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Internal server error' });
      }
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_SEND, async (payload: RoomSendMessagePayload, callback?: (res: any) => void) => {
    try {
      const { roomId, content, type, attachmentUrl, attachmentName, attachmentSize } = payload || {};
      if (!roomId || (!content && !attachmentUrl)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'roomId and content or attachment are required' });
        }
        return;
      }

      const prisma = getPrisma();

      // Verify that user is a member of this room
      const member = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
      });

      if (!member) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Not a member of this room' });
        }
        return;
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

      if (typeof callback === 'function') {
        callback({ success: true, message: receivePayload });
      }
    } catch (err: any) {
      console.error('Error handling room:send:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Internal server error' });
      }
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_READ, async (payload: { roomId: string; messageId: string }, callback?: (res: any) => void) => {
    try {
      if (!payload || !payload.roomId || !payload.messageId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'roomId and messageId are required' });
        }
        return;
      }

      const { roomId, messageId } = payload;
      const prisma = getPrisma();

      // Verify that user is a member of this room
      const member = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
      });

      if (!member) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Not a member of this room' });
        }
        return;
      }

      // Verify target message exists in this room
      const targetMessage = await prisma.roomMessage.findUnique({
        where: { id: messageId },
      });

      if (!targetMessage || targetMessage.roomId !== roomId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Target message not found in this room' });
        }
        return;
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

      if (typeof callback === 'function') {
        callback({ success: true, payload: readPayload });
      }
    } catch (err: any) {
      console.error('Error handling room:read:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Internal server error' });
      }
    }
  });
}

