import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../lib/prisma.js';
import { generateToken } from '../lib/jwt.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { UserDto } from '@webchat/shared';

function toUserDto(user: any): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password, avatarUrl } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ message: 'All fields are required' });
    return;
  }

  const prisma = getPrisma();

  // Check unique username
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (existingUsername) {
    res.status(400).json({ message: 'Username already taken' });
    return;
  }

  // Check unique email
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    res.status(400).json({ message: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      avatarUrl: avatarUrl || null,
    },
  });

  const token = generateToken({
    userId: newUser.id,
    username: newUser.username,
  });

  res.status(201).json({
    token,
    user: toUserDto(newUser),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    res.status(400).json({ message: 'All fields are required' });
    return;
  }

  const prisma = getPrisma();

  // Search by username or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: emailOrUsername },
        { email: emailOrUsername },
      ],
    },
  });

  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const token = generateToken({
    userId: user.id,
    username: user.username,
  });

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
