import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../lib/prisma.js';
import { getServerContext } from '../context.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/session-cookie.js';
import { AuthResponseDto, SelfUserDto, ERROR_CODES, loginSchema, registerSchema, normalizeUsername } from '@webchat/shared';
import { AppError } from '../lib/errors.js';
import { parseInput } from '../lib/validation.js';

/** The signed-in User's own account; the only DTO that carries an email (SEC-13). */
function toSelfUserDto(user: any): SelfUserDto {
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

/** Starts a Session for the User and hands its token to the browser in the Session cookie. */
async function startSession(req: Request, res: Response, userId: string): Promise<void> {
  const { sessions, config } = getServerContext(req);
  const token = await sessions.create(userId, { ip: req.ip, userAgent: req.get('user-agent') });
  setSessionCookie(res, token, config.timing.sessionAbsoluteTtlMs);
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

  await startSession(req, res, newUser.id);

  const body: AuthResponseDto = { user: toSelfUserDto(newUser) };
  res.status(201).json(body);
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

  await startSession(req, res, user.id);

  const body: AuthResponseDto = { user: toSelfUserDto(user) };
  res.status(200).json(body);
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  // `authMiddleware` has resolved the Session and its User.
  const body: AuthResponseDto = { user: toSelfUserDto(req.sessionUser) };
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

/**
 * "Log out everywhere": ends every Session of the User, this one included, and clears the cookie.
 * The socket layer disconnects the User's sockets on every device.
 */
export async function logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { sessions } = getServerContext(req);
  await sessions.revokeAllForUser(req.user!.userId);
  clearSessionCookie(res);
  res.status(204).end();
}
