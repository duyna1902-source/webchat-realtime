import { Server } from 'socket.io';
import { AuthenticatedSocket } from './index.js';
import { getPrisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { socketHandler } from '../lib/async-handler.js';
import type { Logger } from '../lib/logger.js';
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
  MESSAGE_LIMITS,
  ERROR_CODES,
  directSendSchema,
  directTypingSchema,
  directReadSchema,
} from '@webchat/shared';
import { parseInput } from '../lib/validation.js';

export async function handleDirectMessagesDeliveryOnConnect(io: Server, userId: string, log: Logger): Promise<void> {
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
    log.error({ err }, 'Failed to deliver pending direct messages on connect');
  }
}

export function registerDirectChatHandlers(io: Server, socket: AuthenticatedSocket, log: Logger): void {
  const userId = socket.data.user.userId;

  // Automatically join user room for targeted 1-1 messaging
  socket.join(`user:${userId}`);

  socket.on(
    SOCKET_EVENTS.DIRECT_SEND,
    socketHandler<DirectSendMessagePayload>(log, SOCKET_EVENTS.DIRECT_SEND, async (payload) => {
      const { directChatId, content, type, attachmentUrl, attachmentName, attachmentSize } = parseInput(
        directSendSchema,
        payload
      );

      if (content && content.length > MESSAGE_LIMITS.DIRECT) {
        throw new AppError(400, ERROR_CODES.MESSAGE_TOO_LONG, `Message exceeds character limit of ${MESSAGE_LIMITS.DIRECT}`);
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
        throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Direct chat not found');
      }

      const isParticipant = chat.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Sender is not a participant in this direct chat');
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
          type: type || MessageType.TEXT,
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

      return { success: true, message: receivePayload };
    })
  );

  socket.on(
    SOCKET_EVENTS.DIRECT_TYPING,
    socketHandler<DirectTypingPayload>(log, SOCKET_EVENTS.DIRECT_TYPING, async (payload) => {
      const { directChatId, isTyping } = parseInput(directTypingSchema, payload);
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
    })
  );

  socket.on(
    SOCKET_EVENTS.DIRECT_READ,
    socketHandler<DirectReadPayload>(log, SOCKET_EVENTS.DIRECT_READ, async (payload) => {
      const { directChatId, messageId } = parseInput(directReadSchema, payload);
      const prisma = getPrisma();

      // Verify that direct chat exists and caller is a participant
      const chat = await prisma.directChat.findUnique({
        where: { id: directChatId },
        include: {
          participants: true,
        },
      });

      if (!chat) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Direct chat not found');
      }

      const isParticipant = chat.participants.some((p: any) => p.userId === userId);
      if (!isParticipant) {
        throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Caller is not a participant in this direct chat');
      }

      // Find the target message to get its createdAt timestamp
      const targetMessage = await prisma.directMessage.findUnique({
        where: { id: messageId },
      });

      if (!targetMessage || targetMessage.directChatId !== directChatId) {
        throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Target message not found in this direct chat');
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

      return { success: true, payload: readPayload };
    })
  );
}
