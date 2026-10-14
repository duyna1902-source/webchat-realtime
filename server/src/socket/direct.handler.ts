import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import { getPrisma } from '../lib/prisma.js';
import {
  SOCKET_EVENTS,
  DirectSendMessagePayload,
  DirectReceiveMessagePayload,
  DirectTypingPayload,
  MessageType,
  MessageStatus,
} from '@webchat/shared';

export function registerDirectChatHandlers(io: Server, socket: AuthenticatedSocket): void {
  const userId = socket.data.user.userId;

  // Automatically join user room for targeted 1-1 messaging
  socket.join(`user:${userId}`);

  socket.on(SOCKET_EVENTS.DIRECT_SEND, async (payload: DirectSendMessagePayload, callback?: (res: any) => void) => {
    try {
      const { directChatId, content, type, attachmentUrl, attachmentName, attachmentSize } = payload;

      if (!directChatId || (!content && !attachmentUrl)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'directChatId and content or attachment are required' });
        }
        return;
      }

      const prisma = getPrisma();

      // Verify that sender is a participant of this direct chat
      const chat = await prisma.directChat.findUnique({
        where: { id: directChatId },
        include: {
          participants: true,
        },
      });

      if (!chat) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Direct chat not found' });
        }
        return;
      }

      const isParticipant = chat.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Sender is not a participant in this direct chat' });
        }
        return;
      }

      // Create DirectMessage in DB
      const message = await prisma.directMessage.create({
        data: {
          directChatId,
          senderId: userId,
          content: content || '',
          type: (type as any) || MessageType.TEXT,
          status: MessageStatus.SENT,
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
          attachmentSize: attachmentSize || null,
        },
        include: {
          sender: true,
        },
      });

      // Update direct chat timestamp
      await prisma.directChat.update({
        where: { id: directChatId },
        data: { updatedAt: new Date() },
      });

      const receivePayload: DirectReceiveMessagePayload = {
        id: message.id,
        directChatId: message.directChatId,
        senderId: message.senderId,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          avatarUrl: message.sender.avatarUrl,
        },
        content: message.content,
        type: message.type as MessageType,
        status: message.status as MessageStatus,
        attachmentUrl: message.attachmentUrl,
        attachmentName: message.attachmentName,
        attachmentSize: message.attachmentSize,
        createdAt: message.createdAt.toISOString(),
      };

      // Deliver message to each participant's room
      chat.participants.forEach((p) => {
        io.to(`user:${p.userId}`).emit(SOCKET_EVENTS.DIRECT_RECEIVE, receivePayload);
      });

      if (typeof callback === 'function') {
        callback({ success: true, message: receivePayload });
      }
    } catch (err: any) {
      console.error('Error handling direct:send:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Internal server error' });
      }
    }
  });

  socket.on(SOCKET_EVENTS.DIRECT_TYPING, async (payload: { directChatId: string; isTyping: boolean }) => {
    try {
      if (!payload || !payload.directChatId || typeof payload.isTyping !== 'boolean') {
        return;
      }

      const { directChatId, isTyping } = payload;
      const prisma = getPrisma();

      // Verify that direct chat exists and sender is a participant
      const chat = await prisma.directChat.findUnique({
        where: { id: directChatId },
        include: {
          participants: true,
        },
      });

      if (!chat) return;

      const isParticipant = chat.participants.some((p) => p.userId === userId);
      if (!isParticipant) return;

      const typingPayload: DirectTypingPayload = {
        directChatId,
        userId,
        isTyping,
      };

      // Deliver typing indicator to other participants
      chat.participants.forEach((p) => {
        if (p.userId !== userId) {
          io.to(`user:${p.userId}`).emit(SOCKET_EVENTS.DIRECT_TYPING, typingPayload);
        }
      });
    } catch (err: any) {
      console.error('Error handling direct:typing:', err);
    }
  });
}
