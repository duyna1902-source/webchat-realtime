import type { RequestHandler } from 'express';
import { ERROR_CODES } from '@webchat/shared';
import { AppError } from '../lib/errors.js';

/** Methods that change data; only these need proof that the request comes from the app itself. */
const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * CSRF defence next to `SameSite=Strict` (Q44, ADR 0010). A state-changing request must carry
 * `Origin` equal to `APP_ORIGIN`; a browser that sends no `Origin` must say
 * `Sec-Fetch-Site: same-origin`. Anything else, including neither header, is `403`.
 * Applies to every path: auth, JSON APIs and multipart upload alike. No CSRF token is used.
 */
export function requireSameOrigin(appOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (!STATE_CHANGING_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.get('origin');
    const sameOrigin = origin !== undefined ? origin === appOrigin : req.get('sec-fetch-site') === 'same-origin';
    if (!sameOrigin) {
      next(new AppError(403, ERROR_CODES.FORBIDDEN, 'Cross-site request rejected'));
      return;
    }
    next();
  };
}
