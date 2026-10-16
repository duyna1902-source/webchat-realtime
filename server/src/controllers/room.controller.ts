import { Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  RoomDto,
  RoomListItemDto,
  RoomDetailDto,
  RoomMemberDto,
  RoomReceiveMessagePayload,
  PaginatedMessagesDto,
  RoomRole,
  SOCKET_EVENTS,
  RoomMemberChangePayload,
} from '@webchat/shared';
import { toUserDto } from './user.controller.js';
import { getIO } from '../socket/index.js';
import { parsePaginationParams, fetchPaginatedMessages } from '../lib/pagination.js';

export function toRoomReceiveMessagePayload(msg: any): RoomReceiveMessagePayload {
  return {
    id: msg.id,
    roomId: msg.roomId,
    senderId: msg.senderId,
    sender: {
      id: msg.sender.id,
      username: msg.sender.username,
      avatarUrl: msg.sender.avatarUrl,
    },
    content: msg.content,
    type: msg.type,
    attachmentUrl: msg.attachmentUrl ?? null,
    attachmentName: msg.attachmentName ?? null,
    attachmentSize: msg.attachmentSize ?? null,
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : new Date(msg.createdAt).toISOString(),
  };
}

export function toRoomMemberDto(member: any): RoomMemberDto {
  return {
    id: member.id,
    roomId: member.roomId,
    userId: member.userId,
    role: member.role,
    lastReadMessageId: member.lastReadMessageId ?? null,
    joinedAt: member.joinedAt instanceof Date ? member.joinedAt.toISOString() : new Date(member.joinedAt).toISOString(),
    user: toUserDto(member.user),
  };
}

// 1. Create Room
export async function createRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const { name, description } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'Room name is required' });
    return;
  }

  const currentUserId = req.user.userId;
  const prisma = getPrisma();

  // Create room and add creator as OWNER inside a transaction
  const room = await prisma.room.create({
    data: {
      name: name.trim(),
      description: description ? description.trim() : null,
      ownerId: currentUserId,
      members: {
        create: {
          userId: currentUserId,
          role: RoomRole.OWNER,
        },
      },
    },
  });

  const responseDto: RoomDto = {
    id: room.id,
    name: room.name,
    description: room.description,
    ownerId: room.ownerId,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };

  res.status(201).json(responseDto);
}

// 2. Get Rooms current user is member of
export async function getRooms(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const prisma = getPrisma();

  const memberships = await prisma.roomMember.findMany({
    where: { userId: currentUserId },
    include: {
      room: {
        include: {
          members: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: true },
          },
        },
      },
    },
    orderBy: {
      room: {
        updatedAt: 'desc',
      },
    },
  });

  // Collect all lastReadMessageIds for current user memberships
  const readMessageIds: string[] = [];
  memberships.forEach((m) => {
    if (m.lastReadMessageId) {
      readMessageIds.push(m.lastReadMessageId);
    }
  });

  const lastReadMessages = readMessageIds.length > 0
    ? await prisma.roomMessage.findMany({
        where: { id: { in: readMessageIds } },
        select: { id: true, createdAt: true },
      })
    : [];

  const lastReadMap = new Map<string, Date>();
  lastReadMessages.forEach((m) => {
    lastReadMap.set(m.id, m.createdAt);
  });

  const listItems: RoomListItemDto[] = await Promise.all(
    memberships.map(async (membership) => {
      const r = membership.room;
      const lastMsg = r.messages[0] ? toRoomReceiveMessagePayload(r.messages[0]) : null;

      let unreadCount = 0;
      if (membership.lastReadMessageId) {
        const lastReadCreatedAt = lastReadMap.get(membership.lastReadMessageId);
        if (lastReadCreatedAt) {
          unreadCount = await prisma.roomMessage.count({
            where: {
              roomId: r.id,
              senderId: { not: currentUserId },
              createdAt: { gt: lastReadCreatedAt },
            },
          });
        } else {
          unreadCount = await prisma.roomMessage.count({
            where: {
              roomId: r.id,
              senderId: { not: currentUserId },
            },
          });
        }
      } else {
        unreadCount = await prisma.roomMessage.count({
          where: {
            roomId: r.id,
            senderId: { not: currentUserId },
          },
        });
      }

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        ownerId: r.ownerId,
        role: membership.role as RoomRole,
        lastMessage: lastMsg,
        unreadCount,
        memberCount: r.members.length,
        updatedAt: r.updatedAt.toISOString(),
      };
    })
  );

  res.status(200).json(listItems);
}

// 3. Get Room by ID with member roster
export async function getRoomById(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id } = req.params;
  const prisma = getPrisma();

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  const currentMember = room.members.find((m) => m.userId === currentUserId);
  if (!currentMember) {
    res.status(403).json({ message: 'You are not a member of this room' });
    return;
  }

  const responseDto: RoomDetailDto = {
    id: room.id,
    name: room.name,
    description: room.description,
    ownerId: room.ownerId,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    role: currentMember.role as RoomRole,
    memberCount: room.members.length,
    members: room.members.map(toRoomMemberDto),
  };

  res.status(200).json(responseDto);
}

// 4. Add Member
export async function addRoomMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id } = req.params;
  const { userId: targetUserId } = req.body;

  if (!targetUserId || typeof targetUserId !== 'string') {
    res.status(400).json({ message: 'userId is required' });
    return;
  }

  const prisma = getPrisma();

  const room = await prisma.room.findUnique({
    where: { id },
    include: { members: true },
  });

  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  const callerMember = room.members.find((m) => m.userId === currentUserId);
  if (!callerMember || (callerMember.role !== RoomRole.OWNER && callerMember.role !== RoomRole.ADMIN)) {
    res.status(403).json({ message: 'Only owner or admin can add members to this room' });
    return;
  }

  // Validate target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    res.status(404).json({ message: 'Target user not found' });
    return;
  }

  // Check if target user is already a member
  const alreadyMember = room.members.some((m) => m.userId === targetUserId);
  if (alreadyMember) {
    res.status(400).json({ message: 'User is already a member of this room' });
    return;
  }

  const newMember = await prisma.roomMember.create({
    data: {
      roomId: id,
      userId: targetUserId,
      role: RoomRole.MEMBER,
    },
    include: {
      user: true,
    },
  });

  // Broadcast socket event
  const io = getIO();
  if (io) {
    const payload: RoomMemberChangePayload = {
      roomId: id,
      action: 'JOIN',
      userId: targetUser.id,
      username: targetUser.username,
      role: RoomRole.MEMBER,
    };
    io.to(`room:${id}`).emit(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, payload);
    io.to(`user:${targetUser.id}`).emit(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, payload);

    const targetRoom = io.sockets.adapter.rooms.get(`user:${targetUser.id}`);
    if (targetRoom) {
      for (const socketId of targetRoom) {
        const s = io.sockets.sockets.get(socketId);
        if (s) {
          s.join(`room:${id}`);
        }
      }
    }
  }

  res.status(201).json(toRoomMemberDto(newMember));
}

// 5. Remove Member
export async function removeRoomMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id, userId: targetUserId } = req.params;
  const prisma = getPrisma();

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
      },
    },
  });

  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  const callerMember = room.members.find((m) => m.userId === currentUserId);
  if (!callerMember) {
    res.status(403).json({ message: 'You are not a member of this room' });
    return;
  }

  const targetMember = room.members.find((m) => m.userId === targetUserId);
  if (!targetMember) {
    res.status(404).json({ message: 'Target member not found in this room' });
    return;
  }

  // Target is room OWNER: owner cannot be removed
  if (targetMember.role === RoomRole.OWNER) {
    res.status(400).json({ message: 'Cannot remove room owner' });
    return;
  }

  // Permissions check:
  // Caller is MEMBER: forbidden
  if (callerMember.role === RoomRole.MEMBER) {
    res.status(403).json({ message: 'Regular members cannot remove other members' });
    return;
  }

  // Caller is ADMIN: can only remove regular MEMBERs
  if (callerMember.role === RoomRole.ADMIN && targetMember.role !== RoomRole.MEMBER) {
    res.status(403).json({ message: 'Admins can only remove regular members' });
    return;
  }

  // Delete membership
  await prisma.roomMember.delete({
    where: {
      roomId_userId: {
        roomId: id,
        userId: targetUserId,
      },
    },
  });

  // Broadcast socket event
  const io = getIO();
  if (io) {
    const payload: RoomMemberChangePayload = {
      roomId: id,
      action: 'KICK',
      userId: targetMember.userId,
      username: targetMember.user.username,
      role: targetMember.role as RoomRole,
    };
    io.to(`room:${id}`).emit(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, payload);
    io.to(`user:${targetMember.userId}`).emit(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, payload);

    const targetRoom = io.sockets.adapter.rooms.get(`user:${targetMember.userId}`);
    if (targetRoom) {
      for (const socketId of targetRoom) {
        const s = io.sockets.sockets.get(socketId);
        if (s) {
          s.leave(`room:${id}`);
        }
      }
    }
  }

  res.status(200).json({ message: 'Member removed successfully' });
}

// 6. Change Member Role
export async function changeRoomMemberRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id, userId: targetUserId } = req.params;
  const { role } = req.body;

  if (role !== RoomRole.ADMIN && role !== RoomRole.MEMBER) {
    res.status(400).json({ message: 'Valid role (ADMIN or MEMBER) is required' });
    return;
  }

  const prisma = getPrisma();

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
      },
    },
  });

  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  const callerMember = room.members.find((m) => m.userId === currentUserId);
  if (!callerMember || callerMember.role !== RoomRole.OWNER) {
    res.status(403).json({ message: 'Only room owner can change roles' });
    return;
  }

  const targetMember = room.members.find((m) => m.userId === targetUserId);
  if (!targetMember) {
    res.status(404).json({ message: 'Target member not found in this room' });
    return;
  }

  if (targetMember.role === RoomRole.OWNER) {
    res.status(400).json({ message: 'Cannot change role of room owner' });
    return;
  }

  const updatedMember = await prisma.roomMember.update({
    where: {
      roomId_userId: {
        roomId: id,
        userId: targetUserId,
      },
    },
    data: { role },
    include: { user: true },
  });

  // Broadcast socket event
  const io = getIO();
  if (io) {
    const payload: RoomMemberChangePayload = {
      roomId: id,
      action: 'ROLE_CHANGE',
      userId: updatedMember.userId,
      username: updatedMember.user.username,
      role: updatedMember.role as RoomRole,
    };
    io.to(`room:${id}`).emit(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, payload);
  }

  res.status(200).json(toRoomMemberDto(updatedMember));
}

// 7. Leave Room
export async function leaveRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id } = req.params;
  const prisma = getPrisma();

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
      },
    },
  });

  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  const callerMember = room.members.find((m) => m.userId === currentUserId);
  if (!callerMember) {
    res.status(404).json({ message: 'You are not a member of this room' });
    return;
  }

  if (callerMember.role === RoomRole.OWNER) {
    res.status(400).json({ message: 'Owner cannot leave without transferring ownership or deleting room' });
    return;
  }

  await prisma.roomMember.delete({
    where: {
      roomId_userId: {
        roomId: id,
        userId: currentUserId,
      },
    },
  });

  // Broadcast socket event
  const io = getIO();
  if (io) {
    const payload: RoomMemberChangePayload = {
      roomId: id,
      action: 'LEAVE',
      userId: callerMember.userId,
      username: callerMember.user.username,
      role: callerMember.role as RoomRole,
    };
    io.to(`room:${id}`).emit(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, payload);
  }

  res.status(200).json({ success: true, message: 'Left room successfully' });
}

// 8. Delete Room
export async function deleteRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id } = req.params;
  const prisma = getPrisma();

  const room = await prisma.room.findUnique({
    where: { id },
  });

  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  if (room.ownerId !== currentUserId) {
    res.status(403).json({ message: 'Only room owner can delete the room' });
    return;
  }

  // Broadcast DELETE event to room before deleting from DB
  const io = getIO();
  if (io) {
    const payload: RoomMemberChangePayload = {
      roomId: id,
      action: 'DELETE',
      userId: currentUserId,
      username: req.user.username || 'Owner',
    };
    io.to(`room:${id}`).emit(SOCKET_EVENTS.ROOM_MEMBER_CHANGE, payload);
  }

  // Delete room (cascades to RoomMember and RoomMessage)
  await prisma.room.delete({
    where: { id },
  });

  res.status(200).json({ success: true, message: 'Room deleted successfully' });
}

// 9. Get Room Messages
export async function getRoomMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const { id } = req.params;
  const { limit, before, after } = parsePaginationParams(req.query);

  const prisma = getPrisma();

  // Validate room exists and user is a member
  const member = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: {
        roomId: id,
        userId: currentUserId,
      },
    },
  });

  if (!member) {
    res.status(403).json({ message: 'You are not a member of this room' });
    return;
  }

  const { messages, nextCursor, hasMore } = await fetchPaginatedMessages({
    chatIdKey: 'roomId',
    chatId: id,
    limit,
    before,
    after,
    findUniqueMessage: (msgId) => prisma.roomMessage.findUnique({ where: { id: msgId } }),
    findManyMessages: (query) =>
      prisma.roomMessage.findMany({
        ...query,
        include: {
          sender: true,
        },
      }),
  });

  const response: PaginatedMessagesDto<RoomReceiveMessagePayload> = {
    messages: messages.map(toRoomReceiveMessagePayload),
    nextCursor,
    hasMore,
  };

  res.status(200).json(response);
}
