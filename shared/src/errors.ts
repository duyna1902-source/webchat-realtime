import type { FieldError } from './validation.js';

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
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  /** The `attachmentId` of a message does not exist, is someone else's, or is already sent. */
  ATTACHMENT_INVALID: 'ATTACHMENT_INVALID',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Body of every REST error produced by the global error handler. */
export interface ErrorResponseDto {
  message: string;
  code: ErrorCode;
  requestId: string;
  /** Present on `VALIDATION_ERROR`: which fields were rejected and why. */
  fields?: FieldError[];
}

/** Ack sent to a socket event callback when the event fails. */
export interface SocketErrorAck {
  success: false;
  error: ErrorCode;
  requestId: string;
  /** Present on `VALIDATION_ERROR`: which fields were rejected and why. */
  fields?: FieldError[];
}
