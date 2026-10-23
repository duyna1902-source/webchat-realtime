import { ERROR_CODES, parseWithSchema, InputSchema, ParsedInput } from '@webchat/shared';
import { AppError } from './errors.js';

/**
 * Parses client input (a REST body or a socket payload) with one of the shared schemas.
 * On failure it throws a `400 VALIDATION_ERROR` listing the invalid fields, which the error
 * handler answers as `{ message, code, requestId, fields }` (or the socket ack equivalent).
 */
export function parseInput<S extends InputSchema>(schema: S, input: unknown): ParsedInput<S> {
  const result = parseWithSchema(schema, input);
  if (!result.success) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Invalid input', result.fields);
  }
  return result.data;
}
