import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import { getPrisma } from '../lib/prisma.js';
import { presenceManager } from './presence.handler.js';
import {
  SOCKET_EVENTS,
  DirectSendMessagePayload,
  DirectReceiveMessagePayload,
  DirectDeliveredPayload,
  DirectTypingPayload,
  DirectReadPayload,
  MessageType,
  MessageStatus,
} from '@webchat/shared';

export async function handleDirectMessagesDeliveryOnConnect(io: Server, userId: string): Promise<void> {
  try {
    const prisma = getPrisma();
    const pendingMessages = await prisma.directMessage.findMany({
      where: {
        directChat: {
          participants: {
            some: { userId },
          },
        },
        senderId: { not: userId },
        status: MessageStatus.SENT,
      },
      select: {
        id: true,
        directChatId: true,
        senderId: true,
      },
    });

    if (pendingMessages.length === 0) return;

    await prisma.directMessage.updateMany({
      where: {
        id: { in: pendingMessages.map((m) => m.id) },
      },
      data: {
        status: MessageStatus.DELIVERED,
      },
    });

    const notifiedPairs = new Set<string>();
    for (const msg of pendingMessages) {
      const key = `${msg.directChatId}:${msg.senderId}`;
      if (!notifiedPairs.has(key)) {
        notifiedPairs.add(key);
        const payload: DirectDeliveredPayload = {
          directChatId: msg.directChatId,
          deliveredToUserId: userId,
        };
        io.to(`user:${msg.senderId}`).emit(SOCKET_EVENTS.DIRECT_DELIVERED, payload);
      }
    }
  } catch (err) {
    console.error(`Error delivering pending direct messages on connect for user ${userId}:`, err);
  }
}

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

      // Check if recipient is online via presenceManager
      const recipient = chat.participants.find((p) => p.userId !== userId);
      const recipientId = recipient ? recipient.userId : null;
      const isRecipientOnline = recipientId ? presenceManager.isUserOnline(recipientId) : false;
      const initialStatus = isRecipientOnline ? MessageStatus.DELIVERED : MessageStatus.SENT;

      // Create DirectMessage in DB
      const message = await prisma.directMessage.create({
        data: {
          directChatId,
          senderId: userId,
          content: content || '',
          type: (type as any) || MessageType.TEXT,
          status: initialStatus,
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

      const isParticipant = chat.participants.some((p: any) => p.userId === userId);
      if (!isParticipant) return;

      const typingPayload: DirectTypingPayload = {
        directChatId,
        userId,
        isTyping,
      };

      // Deliver typing indicator to other participants
      chat.participants.forEach((p: any) => {
        if (p.userId !== userId) {
          io.to(`user:${p.userId}`).emit(SOCKET_EVENTS.DIRECT_TYPING, typingPayload);
        }
      });
    } catch (err: any) {
      console.error('Error handling direct:typing:', err);
    }
  });

  socket.on(SOCKET_EVENTS.DIRECT_READ, async (payload: { directChatId: string; messageId: string }, callback?: (res: any) => void) => {
    try {
      if (!payload || !payload.directChatId || !payload.messageId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'directChatId and messageId are required' });
        }
        return;
      }

      const { directChatId, messageId } = payload;
      const prisma = getPrisma();

      // Verify that direct chat exists and caller is a participant
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

      const isParticipant = chat.participants.some((p: any) => p.userId === userId);
      if (!isParticipant) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Caller is not a participant in this direct chat' });
        }
        return;
      }

      // Find the target message to get its createdAt timestamp
      const targetMessage = await prisma.directMessage.findUnique({
        where: { id: messageId },
      });

      if (!targetMessage || targetMessage.directChatId !== directChatId) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Target message not found in this direct chat' });
        }
        return;
      }

      // Update caller's lastReadMessageId on DirectChatParticipant
      await prisma.directChatParticipant.update({
        where: {
          directChatId_userId: {
            directChatId,
            userId,
          },
        },
        data: {
          lastReadMessageId: messageId,
        },
      });

      // Update status of messages up to messageId in that chat (where senderId != currentUserId) to READ
      await prisma.directMessage.updateMany({
        where: {
          directChatId,
          senderId: { not: userId },
          createdAt: { lte: targetMessage.createdAt },
          status: { not: MessageStatus.READ },
        },
        data: {
          status: MessageStatus.READ,
        },
      });

      const readPayload: DirectReadPayload = {
        directChatId,
        messageId,
        userId,
        readByUserId: userId,
      };

      // Emit direct:read to recipient's room
      chat.participants.forEach((p: any) => {
        if (p.userId !== userId) {
          io.to(`user:${p.userId}`).emit(SOCKET_EVENTS.DIRECT_READ, readPayload);
        }
      });

      if (typeof callback === 'function') {
        callback({ success: true, payload: readPayload });
      }
    } catch (err: any) {
      console.error('Error handling direct:read:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message || 'Internal server error' });
      }
    }
  });
}

