import type { RequestHandler } from 'express';
import { ERROR_CODES } from '@webchat/shared';
import { getServerContext } from '../context.js';
import { AppError } from '../lib/errors.js';
import { logSecurityEvent } from '../lib/security-events.js';
import { TURNSTILE_TOKEN_MAX_LENGTH } from '../lib/turnstile.js';

const FAILED_MESSAGE = 'Verification failed. Please complete the check and try again.';
const UNAVAILABLE_MESSAGE = 'Verification is unavailable right now. Please try again in a moment.';

/**
 * Route middleware for register and login: when Turnstile is enabled, the body must carry a
 * `turnstileToken` that Cloudflare accepts. Missing or refused token: `400 CAPTCHA_FAILED`.
 * Cloudflare unreachable: `503 CAPTCHA_UNAVAILABLE` (fails closed). Turnstile disabled: no-op.
 */
export function requireTurnstile(): RequestHandler {
  return (req, _res, next) => {
    const verify = getServerContext(req).turnstile;
    if (!verify) {
      next();
      return;
    }

    const token: unknown = req.body?.turnstileToken;
    if (typeof token !== 'string' || token.length === 0 || token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
      logSecurityEvent(req.log, 'auth.captcha.failure', { path: req.originalUrl, reason: 'missing_token' });
      next(new AppError(400, ERROR_CODES.CAPTCHA_FAILED, FAILED_MESSAGE));
      return;
    }

    verify(token, req.ip).then(
      (result) => {
        if (result.success) {
          next();
          return;
        }
        logSecurityEvent(req.log, 'auth.captcha.failure', {
          path: req.originalUrl,
          reason: 'rejected',
          errorCodes: result.errorCodes.join(',') || null,
        });
        next(new AppError(400, ERROR_CODES.CAPTCHA_FAILED, FAILED_MESSAGE));
      },
      (err: unknown) => {
        req.log.error({ err }, 'Turnstile verification could not reach Cloudflare');
        next(new AppError(503, ERROR_CODES.CAPTCHA_UNAVAILABLE, UNAVAILABLE_MESSAGE));
      }
    );
  };
}
