import { Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { UserDto } from '@webchat/shared';

export function toUserDto(user: any): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt instanceof Date ? user.lastSeenAt.toISOString() : new Date(user.lastSeenAt).toISOString(),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString(),
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt).toISOString(),
  };
}

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const currentUserId = req.user.userId;
  const search = ((req.query.q as string) || (req.query.search as string) || '').trim();

  const prisma = getPrisma();

  const whereClause: any = {
    id: { not: currentUserId },
  };

  if (search) {
    whereClause.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    orderBy: { username: 'asc' },
  });

  res.status(200).json(users.map(toUserDto));
}
