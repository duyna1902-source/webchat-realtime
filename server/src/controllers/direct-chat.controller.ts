import { Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  normalizeDirectChatPair,
  DirectChatDto,
  DirectChatListItemDto,
  DirectReceiveMessagePayload,
  PaginatedMessagesDto,
  createDirectChatSchema,
} from '@webchat/shared';
import { parseInput } from '../lib/validation.js';
import { toPublicUserDto } from './user.controller.js';
import { parsePaginationParams, fetchPaginatedMessages } from '../lib/pagination.js';
import { attachmentOf, signAttachments, SignedAttachments } from '../lib/attachments.js';
import { attachmentSigner } from '../context.js';

/** `msg` must include `sender` and `attachment`; `attachments` holds its signed Attachment. */
export function toDirectReceiveMessagePayload(msg: any, attachments: SignedAttachments): DirectReceiveMessagePayload {
  return {
    id: msg.id,
    directChatId: msg.directChatId,
    senderId: msg.senderId,
    sender: toPublicUserDto(msg.sender),
    content: msg.content,
    type: msg.type,
    status: msg.status,
    attachment: attachmentOf(msg, attachments),
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date(msg.createdAt).toISOString(),
  };
}

export async function createOrGetDirectChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { targetUserId } = parseInput(createDirectChatSchema, req.body);

  if (targetUserId === currentUserId) {
    res.status(400).json({ message: 'Cannot create direct chat with yourself' });
    return;
  }

  const prisma = getPrisma();

  // Validate target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    res.status(404).json({ message: 'Target user not found' });
    return;
  }

  const [user1Id, user2Id] = normalizeDirectChatPair(currentUserId, targetUserId);

  // Check if direct chat already exists
  const existingChat = await prisma.directChat.findUnique({
    where: {
      user1Id_user2Id: { user1Id, user2Id },
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  if (existingChat) {
    const partner = existingChat.user1Id === currentUserId ? existingChat.user2 : existingChat.user1;
    const responseDto: DirectChatDto = {
      id: existingChat.id,
      user1Id: existingChat.user1Id,
      user2Id: existingChat.user2Id,
      createdAt: existingChat.createdAt.toISOString(),
      updatedAt: existingChat.updatedAt.toISOString(),
      partner: toPublicUserDto(partner),
    };
    res.status(200).json(responseDto);
    return;
  }

  // Create new DirectChat and participants
  const newChat = await prisma.directChat.create({
    data: {
      user1Id,
      user2Id,
      participants: {
        create: [
          { userId: user1Id },
          { userId: user2Id },
        ],
      },
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const partner = newChat.user1Id === currentUserId ? newChat.user2 : newChat.user1;
  const responseDto: DirectChatDto = {
    id: newChat.id,
    user1Id: newChat.user1Id,
    user2Id: newChat.user2Id,
    createdAt: newChat.createdAt.toISOString(),
    updatedAt: newChat.updatedAt.toISOString(),
    partner: toPublicUserDto(partner),
  };

  res.status(201).json(responseDto);
}

export async function getDirectChats(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const prisma = getPrisma();

  const chats = await prisma.directChat.findMany({
    where: {
      OR: [
        { user1Id: currentUserId },
        { user2Id: currentUserId },
      ],
    },
    include: {
      user1: true,
      user2: true,
      participants: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          sender: true,
          attachment: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Collect all lastReadMessageIds for current user
  const readMessageIds: string[] = [];
  chats.forEach((chat) => {
    const myParticipant = chat.participants.find((p) => p.userId === currentUserId);
    if (myParticipant?.lastReadMessageId) {
      readMessageIds.push(myParticipant.lastReadMessageId);
    }
  });

  const lastReadMessages = readMessageIds.length > 0
    ? await prisma.directMessage.findMany({
        where: { id: { in: readMessageIds } },
        select: { id: true, createdAt: true },
      })
    : [];

  const lastReadMap = new Map<string, Date>();
  lastReadMessages.forEach((m) => {
    lastReadMap.set(m.id, m.createdAt);
  });

  const signedAttachments = await signAttachments(
    attachmentSigner(req),
    chats.map((chat) => chat.messages[0]?.attachment)
  );

  const listItems: DirectChatListItemDto[] = await Promise.all(
    chats.map(async (chat) => {
      const partner = chat.user1Id === currentUserId ? chat.user2 : chat.user1;
      const partnerId = partner.id;
      const lastMsg = chat.messages[0] ? toDirectReceiveMessagePayload(chat.messages[0], signedAttachments) : null;
      const myParticipant = chat.participants.find((p) => p.userId === currentUserId);
      const partnerParticipant = chat.participants.find((p) => p.userId !== currentUserId);

      let unreadCount = 0;
      if (myParticipant?.lastReadMessageId) {
        const lastReadCreatedAt = lastReadMap.get(myParticipant.lastReadMessageId);
        if (lastReadCreatedAt) {
          unreadCount = await prisma.directMessage.count({
            where: {
              directChatId: chat.id,
              senderId: partnerId,
              createdAt: { gt: lastReadCreatedAt },
            },
          });
        } else {
          unreadCount = await prisma.directMessage.count({
            where: {
              directChatId: chat.id,
              senderId: partnerId,
            },
          });
        }
      } else {
        unreadCount = await prisma.directMessage.count({
          where: {
            directChatId: chat.id,
            senderId: partnerId,
          },
        });
      }

      return {
        id: chat.id,
        partner: toPublicUserDto(partner),
        lastMessage: lastMsg,
        unreadCount,
        lastReadMessageId: myParticipant?.lastReadMessageId ?? null,
        partnerLastReadMessageId: partnerParticipant?.lastReadMessageId ?? null,
        updatedAt: chat.updatedAt.toISOString(),
      };
    })
  );

  res.status(200).json(listItems);
}

export async function getDirectChatMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id } = req.params;
  const { limit, before, after } = parsePaginationParams(req.query);

  const prisma = getPrisma();

  // Validate chat exists and include participants
  const chat = await prisma.directChat.findUnique({
    where: { id },
    include: {
      participants: true,
    },
  });

  if (!chat) {
    res.status(404).json({ message: 'Direct chat not found' });
    return;
  }

  // Verify that requesting user is a participant
  const isParticipant = chat.participants.some((p) => p.userId === currentUserId);
  if (!isParticipant) {
    res.status(403).json({ message: 'You are not a participant in this direct chat' });
    return;
  }

  const { messages, nextCursor, hasMore } = await fetchPaginatedMessages({
    chatIdKey: 'directChatId',
    chatId: id,
    limit,
    before,
    after,
    findUniqueMessage: (msgId) => prisma.directMessage.findUnique({ where: { id: msgId } }),
    findManyMessages: (query) =>
      prisma.directMessage.findMany({
        ...query,
        include: {
          sender: true,
          attachment: true,
        },
      }),
  });

  const signedAttachments = await signAttachments(
    attachmentSigner(req),
    messages.map((m: any) => m.attachment)
  );
  const response: PaginatedMessagesDto<DirectReceiveMessagePayload> = {
    messages: messages.map((m) => toDirectReceiveMessagePayload(m, signedAttachments)),
    nextCursor,
    hasMore,
  };

  res.status(200).json(response);
}

