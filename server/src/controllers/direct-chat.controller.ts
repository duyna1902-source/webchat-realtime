import { Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { normalizeDirectChatPair, DirectChatDto, DirectChatListItemDto, DirectReceiveMessagePayload, PaginatedMessagesDto } from '@webchat/shared';
import { toUserDto } from './user.controller.js';

export function toDirectReceiveMessagePayload(msg: any): DirectReceiveMessagePayload {
  return {
    id: msg.id,
    directChatId: msg.directChatId,
    senderId: msg.senderId,
    sender: {
      id: msg.sender.id,
      username: msg.sender.username,
      avatarUrl: msg.sender.avatarUrl,
    },
    content: msg.content,
    type: msg.type,
    status: msg.status,
    attachmentUrl: msg.attachmentUrl ?? null,
    attachmentName: msg.attachmentName ?? null,
    attachmentSize: msg.attachmentSize ?? null,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date(msg.createdAt).toISOString(),
  };
}

export async function createOrGetDirectChat(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { targetUserId } = req.body;

  if (!targetUserId || typeof targetUserId !== 'string') {
    res.status(400).json({ message: 'targetUserId is required' });
    return;
  }

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
      partner: toUserDto(partner),
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
    partner: toUserDto(partner),
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
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const listItems: DirectChatListItemDto[] = chats.map((chat) => {
    const partner = chat.user1Id === currentUserId ? chat.user2 : chat.user1;
    const lastMsg = chat.messages[0] ? toDirectReceiveMessagePayload(chat.messages[0]) : null;
    const myParticipant = chat.participants.find((p) => p.userId === currentUserId);
    const partnerParticipant = chat.participants.find((p) => p.userId !== currentUserId);

    return {
      id: chat.id,
      partner: toUserDto(partner),
      lastMessage: lastMsg,
      unreadCount: 0,
      lastReadMessageId: myParticipant?.lastReadMessageId ?? null,
      partnerLastReadMessageId: partnerParticipant?.lastReadMessageId ?? null,
      updatedAt: chat.updatedAt.toISOString(),
    };
  });

  res.status(200).json(listItems);
}

export async function getDirectChatMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id } = req.params;
  const limitParam = parseInt(req.query.limit as string, 10);
  const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 100);
  const before = req.query.before as string | undefined;
  const after = req.query.after as string | undefined;

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

  // Catch-up sync: fetch messages newer than `after` message in chronological order (createdAt ASC)
  if (after) {
    const afterMsg = await prisma.directMessage.findUnique({ where: { id: after } });
    if (!afterMsg || afterMsg.directChatId !== id) {
      res.status(200).json({ messages: [], nextCursor: null, hasMore: false });
      return;
    }

    const whereClause: any = {
      directChatId: id,
      createdAt: { gt: afterMsg.createdAt },
    };

    if (before) {
      const cursorMsg = await prisma.directMessage.findUnique({ where: { id: before } });
      if (cursorMsg) {
        whereClause.createdAt.lt = cursorMsg.createdAt;
      }
    }

    const rawMessages = await prisma.directMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      include: {
        sender: true,
      },
    });

    const hasMore = rawMessages.length > limit;
    const messagesBatch = hasMore ? rawMessages.slice(0, limit) : rawMessages;
    const nextCursor = hasMore ? messagesBatch[messagesBatch.length - 1].id : null;
    const chronologicalMessages = messagesBatch.map(toDirectReceiveMessagePayload);

    const response: PaginatedMessagesDto<DirectReceiveMessagePayload> = {
      messages: chronologicalMessages,
      nextCursor,
      hasMore,
    };

    res.status(200).json(response);
    return;
  }

  // Build query
  const whereClause: any = { directChatId: id };
  if (before) {
    const cursorMsg = await prisma.directMessage.findUnique({ where: { id: before } });
    if (cursorMsg) {
      whereClause.createdAt = { lt: cursorMsg.createdAt };
    }
  }

  // Fetch up to limit + 1 in descending order
  const rawMessages = await prisma.directMessage.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      sender: true,
    },
  });

  const hasMore = rawMessages.length > limit;
  const messagesBatch = hasMore ? rawMessages.slice(0, limit) : rawMessages;
  const nextCursor = hasMore ? messagesBatch[messagesBatch.length - 1].id : null;

  // Reverse so they are in chronological order (createdAt ASC)
  const chronologicalMessages = [...messagesBatch].reverse().map(toDirectReceiveMessagePayload);

  const response: PaginatedMessagesDto<DirectReceiveMessagePayload> = {
    messages: chronologicalMessages,
    nextCursor,
    hasMore,
  };

  res.status(200).json(response);
}

