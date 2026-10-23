import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../lib/prisma.js';
import { getServerContext } from '../context.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/session-cookie.js';
import { AuthResponseDto, SelfUserDto, ERROR_CODES, loginSchema, registerSchema, normalizeUsername } from '@webchat/shared';
import { AppError } from '../lib/errors.js';
import { uniqueViolationTargets } from '../lib/prisma-errors.js';
import { parseInput } from '../lib/validation.js';
import { logSecurityEvent } from '../lib/security-events.js';

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

function isEmailLogin(emailOrUsername: string): boolean {
  return emailOrUsername.includes('@');
}

/** The login identifier as it is matched (lowercased email or normalized username), for the log. */
function normalizeLoginIdentifier(emailOrUsername: string): string {
  return isEmailLogin(emailOrUsername) ? emailOrUsername.toLowerCase() : normalizeUsername(emailOrUsername);
}

/**
 * Exact match only: an email (stored lowercase) or a username compared case-insensitively
 * through its normalized key.
 */
async function findUserByLogin(emailOrUsername: string) {
  const prisma = getPrisma();
  if (isEmailLogin(emailOrUsername)) {
    return prisma.user.findUnique({ where: { email: emailOrUsername.toLowerCase() } });
  }
  return prisma.user.findUnique({ where: { usernameNormalized: normalizeUsername(emailOrUsername) } });
}

/**
 * The validation error for a registration the database refused as a duplicate. The unique
 * constraints on the normalized username and on the (lowercase) email are the only guard, so
 * two registrations racing for the same name cannot both get in. Null for any other error.
 */
function duplicateAccountError(err: unknown): AppError | null {
  const targets = uniqueViolationTargets(err);
  if (!targets) return null;
  if (targets.some((target) => /username/i.test(target))) {
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Username already taken', [
      { field: 'username', message: 'Username already taken' },
    ]);
  }
  if (targets.some((target) => /email/i.test(target))) {
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Email already registered', [
      { field: 'email', message: 'Email already registered' },
    ]);
  }
  return null;
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password } = parseInput(registerSchema, req.body);
  const passwordHash = await bcrypt.hash(password, 10);

  let newUser;
  try {
    newUser = await getPrisma().user.create({
      data: {
        username,
        usernameNormalized: normalizeUsername(username),
        email,
        passwordHash,
      },
    });
  } catch (err) {
    throw duplicateAccountError(err) ?? err;
  }

  await startSession(req, res, newUser.id);
  logSecurityEvent(req.log, 'auth.register', { userId: newUser.id });

  const body: AuthResponseDto = { user: toSelfUserDto(newUser) };
  res.status(201).json(body);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { emailOrUsername, password } = parseInput(loginSchema, req.body);
  const user = await findUserByLogin(emailOrUsername);
  const identifier = normalizeLoginIdentifier(emailOrUsername);

  if (!user) {
    logSecurityEvent(req.log, 'auth.login.failure', { identifier, reason: 'unknown_user' });
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    logSecurityEvent(req.log, 'auth.login.failure', { identifier, reason: 'wrong_password', userId: user.id });
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  await startSession(req, res, user.id);
  logSecurityEvent(req.log, 'auth.login.success', { userId: user.id });

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
    logSecurityEvent(req.log, 'auth.logout', { userId: resolved.user.id });
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
  const revoked = await sessions.revokeAllForUser(req.user!.userId);
  logSecurityEvent(req.log, 'auth.logout_all', { userId: req.user!.userId, revoked });
  clearSessionCookie(res);
  res.status(204).end();
}
