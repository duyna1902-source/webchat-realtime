import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../lib/prisma.js';
import { getServerContext } from '../context.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/session-cookie.js';
import { AuthResponseDto, UserDto } from '@webchat/shared';

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

/** Starts a Session for the User and hands its token to the browser in the Session cookie. */
async function startSession(req: Request, res: Response, userId: string): Promise<void> {
  const { sessions, config } = getServerContext(req);
  const token = await sessions.create(userId, { ip: req.ip, userAgent: req.get('user-agent') });
  setSessionCookie(res, token, config.timing.sessionAbsoluteTtlMs);
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

  await startSession(req, res, newUser.id);

  const body: AuthResponseDto = { user: toUserDto(newUser) };
  res.status(201).json(body);
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

  await startSession(req, res, user.id);

  const body: AuthResponseDto = { user: toUserDto(user) };
  res.status(200).json(body);
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  // `authMiddleware` has resolved the Session and its User.
  const body: AuthResponseDto = { user: toUserDto(req.sessionUser) };
  res.status(200).json(body);
}

/** Ends the current Session on the server and clears the cookie. Answers 204 even without a Session. */
export async function logout(req: Request, res: Response): Promise<void> {
  const { sessions } = getServerContext(req);
  const resolved = await sessions.resolve(readSessionToken(req.headers.cookie));
  if (resolved) {
    await sessions.revoke(resolved.session.id);
  }
  clearSessionCookie(res);
  res.status(204).end();
}
