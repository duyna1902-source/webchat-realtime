import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { getServerContext } from '../context.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { UserDto, ERROR_CODES, loginSchema, registerSchema, normalizeUsername } from '@webchat/shared';
import { AppError } from '../lib/errors.js';
import { parseInput } from '../lib/validation.js';

function toUserDto(user: any): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Exact match only: an email (stored lowercase) or a username compared case-insensitively
 * through its normalized key. Rows created before the key existed match on the exact username.
 */
async function findUserByLogin(emailOrUsername: string) {
  const prisma = getPrisma();
  if (emailOrUsername.includes('@')) {
    return prisma.user.findUnique({ where: { email: emailOrUsername.toLowerCase() } });
  }
  return prisma.user.findFirst({
    where: {
      OR: [{ usernameNormalized: normalizeUsername(emailOrUsername) }, { username: emailOrUsername }],
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password } = parseInput(registerSchema, req.body);
  const usernameNormalized = normalizeUsername(username);

  const prisma = getPrisma();

  // Case-insensitive, also against rows the data upgrade has not given a normalized key yet.
  // Until the contract migration adds the unique constraint, this check is the only guard.
  const [existingUsername] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User"
     WHERE "usernameNormalized" = ${usernameNormalized} OR lower("username") = ${usernameNormalized}
     LIMIT 1`;
  if (existingUsername) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Username already taken', [
      { field: 'username', message: 'Username already taken' },
    ]);
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Email already registered', [
      { field: 'email', message: 'Email already registered' },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      username,
      usernameNormalized,
      email,
      passwordHash,
    },
  });

  const token = signToken(
    {
      userId: newUser.id,
      username: newUser.username,
    },
    getServerContext(req).config.jwtSecret
  );

  res.status(201).json({
    token,
    user: toUserDto(newUser),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { emailOrUsername, password } = parseInput(loginSchema, req.body);
  const user = await findUserByLogin(emailOrUsername);

  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const token = signToken(
    {
      userId: user.id,
      username: user.username,
    },
    getServerContext(req).config.jwtSecret
  );

  res.status(200).json({
    token,
    user: toUserDto(user),
  });
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.status(200).json(toUserDto(user));
}
