import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { SocketErrorAck } from '@webchat/shared';
import { toPublicError } from './errors.js';
import type { Logger } from './logger.js';

/**
 * Express 4 does not catch rejected promises from route handlers; an async throw would become
 * an unhandled rejection instead of a response. This forwards every throw to the error handler.
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req as Req, res, next))
      .catch(next);
  };
}

export interface SocketEventContext {
  /** Reference code for this event, sent back in error acks and present in every log line. */
  requestId: string;
  log: Logger;
}

type Ack = (response: unknown) => void;

/**
 * The socket equivalent of `asyncHandler`: gives each event a `requestId` and a bound logger,
 * and turns any throw into an ack of `{ success: false, error: <code>, requestId }`. Throw an
 * `AppError` for an expected failure; anything else is logged with its stack and acked as
 * `INTERNAL_ERROR`. On success the handler's return value (if any) is sent as the ack.
 */
export function socketHandler<P = unknown>(
  log: Logger,
  event: string,
  handler: (payload: P | undefined, ctx: SocketEventContext) => unknown
): (...args: unknown[]) => void {
  return (...args) => {
    // `socket.emit(event, ack)` passes the ack as the first argument.
    const ack = typeof args[args.length - 1] === 'function' ? (args.pop() as Ack) : undefined;
    const payload = args[0] as P | undefined;
    const requestId = randomUUID();
    const ctx: SocketEventContext = { requestId, log: log.child({ requestId, event }) };

    Promise.resolve()
      .then(() => handler(payload, ctx))
      .then((result) => {
        if (ack && result !== undefined) ack(result);
      })
      .catch((err: unknown) => {
        const publicError = toPublicError(err);
        if (publicError.status >= 500) {
          ctx.log.error({ err }, 'Socket event failed');
        } else {
          ctx.log.info({ code: publicError.code }, 'Socket event rejected');
        }
        if (ack) {
          const response: SocketErrorAck = { success: false, error: publicError.code, requestId };
          if (publicError.fields) response.fields = publicError.fields;
          if (publicError.retryAfterMs !== undefined) response.retryAfterMs = publicError.retryAfterMs;
          ack(response);
        }
      })
      .catch((err: unknown) => {
        // The ack itself threw; nothing left to answer, so only log it.
        ctx.log.error({ err }, 'Socket ack failed');
      });
  };
}
