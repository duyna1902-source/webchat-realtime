import type { ErrorRequestHandler } from 'express';
import type { ErrorResponseDto } from '@webchat/shared';
import { toPublicError } from '../lib/errors.js';

/**
 * Global error handler. The client only ever gets `{ message, code, requestId }` with a
 * generic message; the raw error and its stack go to the log under the same `requestId`.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const publicError = toPublicError(err);
  if (publicError.status >= 500) {
    req.log.error({ err, method: req.method, path: req.path }, 'Request failed');
  } else {
    req.log.info({ code: publicError.code, status: publicError.status, method: req.method, path: req.path }, 'Request rejected');
  }

  const body: ErrorResponseDto = {
    message: publicError.message,
    code: publicError.code,
    requestId: req.requestId,
  };
  res.status(publicError.status).json(body);
};
