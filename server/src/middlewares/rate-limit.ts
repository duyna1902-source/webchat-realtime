import type { Request, RequestHandler } from 'express';
import { rateLimit as expressRateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { RateLimitRule, RateLimitsConfig } from '../config.js';
import { getServerContext } from '../context.js';
import { RateLimitedError } from '../lib/errors.js';
import { logRateLimitHit } from '../lib/rate-limit.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

// REST rate limiting (SEC-07) on `express-rate-limit` with its in-memory store: valid only for a
// single instance. See `lib/rate-limit.ts` before scaling horizontally.

export type RestRateLimitName = Exclude<keyof RateLimitsConfig, 'messageSend' | 'typing'>;
export type RestRateLimiters = Record<RestRateLimitName, RequestHandler>;

/** Client IP; behind Render's proxy this relies on `trust proxy` being set in the factory. */
function ipKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown');
}

/** Per account; mounted after `authMiddleware`. Falls back to the IP if no User is attached. */
function userKey(req: Request): string {
  const userId = (req as AuthenticatedRequest).user?.userId;
  return userId ? `user:${userId}` : `ip:${ipKey(req)}`;
}

/** IP plus the lowercased identifier being guessed, so one attacker cannot lock out every account. */
function loginKey(req: Request): string {
  const identifier = req.body?.emailOrUsername;
  const normalized = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  return `${ipKey(req)}|${normalized}`;
}

function createLimiter(
  name: RestRateLimitName,
  rule: RateLimitRule,
  keyGenerator: (req: Request) => string,
  options: { onlyFailures?: boolean } = {}
): RequestHandler {
  return expressRateLimit({
    windowMs: rule.windowMs,
    limit: rule.max,
    keyGenerator,
    // Login counts failed attempts only: a successful request is refunded once it responds < 400.
    skipSuccessfulRequests: options.onlyFailures ?? false,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, res, next) => {
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const error = new RateLimitedError(resetTime ? resetTime.getTime() - Date.now() : rule.windowMs);
      res.setHeader('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
      logRateLimitHit(req.log, name, error.retryAfterMs);
      next(error);
    },
  });
}

/** One set of limiters (and counters) per server instance; built by the server factory. */
export function createRestRateLimiters(rules: RateLimitsConfig): RestRateLimiters {
  return {
    loginFailures: createLimiter('loginFailures', rules.loginFailures, loginKey, { onlyFailures: true }),
    register: createLimiter('register', rules.register, ipKey),
    upload: createLimiter('upload', rules.upload, userKey),
    userSearch: createLimiter('userSearch', rules.userSearch, userKey),
    gifs: createLimiter('gifs', rules.gifs, userKey),
    roomCreate: createLimiter('roomCreate', rules.roomCreate, userKey),
  };
}

/** Route middleware applying this server instance's `name` limiter. Over the limit: `429` with `Retry-After`. */
export function rateLimit(name: RestRateLimitName): RequestHandler {
  return (req, res, next) => getServerContext(req).rateLimiters[name](req, res, next);
}
