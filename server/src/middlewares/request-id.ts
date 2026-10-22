import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../lib/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Reference code for this request, echoed in `X-Request-Id` and in every log line. */
      requestId: string;
      /** Logger bound to this request (`requestId`, `ip`, and `userId` once authenticated). */
      log: Logger;
    }
  }
}

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Gives each request a fresh server-generated `requestId` (a client-supplied id is never
 * trusted, so it cannot be used to forge log lines) and a logger bound to it.
 */
export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID();
    req.requestId = requestId;
    req.log = logger.child({ requestId, ip: req.ip });
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  };
}
