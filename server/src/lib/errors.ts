import http from 'node:http';
import { ERROR_CODES, ErrorCode, FieldError } from '@webchat/shared';

/**
 * An expected failure whose `message` is safe to show the user. Anything thrown that is
 * not an `AppError` is treated as an unexpected internal error and never shown.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  /** Invalid fields, shown to the client as they are (validation errors only). */
  readonly fields?: FieldError[];

  constructor(
    status: number,
    code: ErrorCode,
    message: string = http.STATUS_CODES[status] ?? 'Error',
    fields?: FieldError[]
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface PublicError {
  status: number;
  code: ErrorCode;
  message: string;
  fields?: FieldError[];
}

export const INTERNAL_ERROR: PublicError = {
  status: 500,
  code: ERROR_CODES.INTERNAL_ERROR,
  message: 'Internal server error',
};

/**
 * Maps any thrown value to what the client may see. Only `AppError` and the client errors
 * raised by Express itself (body parsing) keep their status; their raw messages are never used.
 */
export function toPublicError(err: unknown): PublicError {
  if (err instanceof AppError) {
    return err.fields
      ? { status: err.status, code: err.code, message: err.message, fields: err.fields }
      : { status: err.status, code: err.code, message: err.message };
  }

  const candidate = err as { type?: unknown; status?: unknown; expose?: unknown } | null;
  if (candidate?.type === 'entity.too.large') {
    return { status: 413, code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: 'Request body is too large' };
  }
  if (candidate?.type === 'entity.parse.failed') {
    return { status: 400, code: ERROR_CODES.INVALID_JSON, message: 'Request body is not valid JSON' };
  }
  // Other http-errors from Express middleware (e.g. unsupported charset): keep the 4xx status only.
  const status = typeof candidate?.status === 'number' ? candidate.status : 0;
  if (candidate?.expose === true && status >= 400 && status < 500) {
    return { status, code: ERROR_CODES.BAD_REQUEST, message: http.STATUS_CODES[status] ?? 'Bad request' };
  }

  return INTERNAL_ERROR;
}
