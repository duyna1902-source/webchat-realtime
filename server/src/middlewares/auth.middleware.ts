import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '@webchat/shared';
import { getServerContext } from '../context.js';
import { AppError } from '../lib/errors.js';
import { readSessionToken } from '../lib/session-cookie.js';
import type { ActiveSession, SessionUser } from '../lib/session-store.js';

/** The User a request acts as. */
export interface RequestUser {
  userId: string;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
  /** The Session the request came with. */
  session?: ActiveSession;
  /** The full record of `user`, without the password hash. */
  sessionUser?: SessionUser;
}

/**
 * REST authentication: the Session comes only from the `__Host-session` cookie (no `Authorization`
 * header is read). An unknown, expired or revoked Session gets `401`.
 */
export function authMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = readSessionToken(req.headers.cookie);

  getServerContext(req)
    .sessions.resolve(token)
    .then(
      (resolved) => {
        if (!resolved) {
          next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
          return;
        }
        req.user = { userId: resolved.user.id, username: resolved.user.username };
        req.session = resolved.session;
        req.sessionUser = resolved.user;
        req.log = req.log.child({ userId: resolved.user.id });
        next();
      },
      (err: unknown) => next(err)
    );
}
