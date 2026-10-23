import { Response } from 'express';
import { getPrisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { PublicUserDto, USER_SEARCH_MAX_RESULTS, userSearchQuerySchema } from '@webchat/shared';
import { parseInput } from '../lib/validation.js';

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * The only shape in which another User leaves the server: user lists, Room Members,
 * Direct Chat partners and message senders, over REST and socket alike (SEC-13).
 */
export function toPublicUserDto(user: any): PublicUserDto {
  return {
    id: user.id,
    username: user.username,
    isOnline: user.isOnline,
    lastSeenAt: toIsoString(user.lastSeenAt),
  };
}

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const { q } = parseInput(userSearchQuerySchema, req.query);

  const users = await getPrisma().user.findMany({
    where: {
      id: { not: req.user.userId },
      username: { contains: q, mode: 'insensitive' },
    },
    orderBy: { username: 'asc' },
    take: USER_SEARCH_MAX_RESULTS,
  });

  res.status(200).json(users.map(toPublicUserDto));
}
