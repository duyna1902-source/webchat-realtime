// ==========================================
// ERROR CONTRACT
// ==========================================
// Errors never carry internal details. REST answers `ErrorResponseDto`, socket acks answer
// `SocketErrorAck`; both carry a `requestId` the user can quote and the operator can find in the log.

export const ERROR_CODES = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_JSON: 'INVALID_JSON',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Body of every REST error produced by the global error handler. */
export interface ErrorResponseDto {
  message: string;
  code: ErrorCode;
  requestId: string;
  /** With `RATE_LIMITED`: how long to wait before retrying (the `Retry-After` header, in ms). */
  retryAfterMs?: number;
}

/** Ack sent to a socket event callback when the event fails. */
export interface SocketErrorAck {
  success: false;
  error: ErrorCode;
  requestId: string;
  /** With `RATE_LIMITED`: how long to wait before retrying, in ms. */
  retryAfterMs?: number;
}

/** "Too many requests. Try again in 3 seconds." Shared so the server and client word it alike. */
export function formatRateLimitMessage(retryAfterMs: number): string {
  return `Too many requests. Try again in ${formatWaitTime(retryAfterMs)}.`;
}

/** Rounds a wait up to whole seconds, minutes or hours: "1 second", "15 minutes", "1 hour". */
export function formatWaitTime(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return plural(seconds, 'second');
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return plural(minutes, 'minute');
  return plural(Math.ceil(minutes / 60), 'hour');
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}
