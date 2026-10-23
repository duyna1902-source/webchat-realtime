import type { RequestHandler } from 'express';
import { logSecurityEvent } from '../lib/security-events.js';

/**
 * Logs every `401` and `403` response as an `http.401` / `http.403` security event, whichever
 * handler sent it. Read when the response finishes, so the line carries the `userId` that
 * authentication may have bound to `req.log` in the meantime. The query string is left out.
 */
export const logRefusedRequests: RequestHandler = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode !== 401 && res.statusCode !== 403) return;
    logSecurityEvent(req.log, res.statusCode === 401 ? 'http.401' : 'http.403', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
    });
  });
  next();
};
