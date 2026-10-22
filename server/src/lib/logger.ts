import { pino, stdSerializers, Logger, DestinationStream } from 'pino';
import type { LogLevel } from '../config.js';

export type { Logger };

// ==========================================
// STRUCTURED LOGGER
// ==========================================
// JSON lines through pino. Every value whose key looks sensitive is replaced before the line
// is written, at any depth, including inside logged errors and child-logger bindings.

const SENSITIVE_KEY = /password|cookie|authorization|secret|token/i;
export const REDACTED = '[Redacted]';

function serializeError(err: Error): Record<string, unknown> {
  const serialized = stdSerializers.err(err) as unknown as Record<string, unknown>;
  // Copy into a plain object so the redaction walk below sees every field.
  return { ...serialized, type: serialized.type, message: serialized.message, stack: serialized.stack };
}

/** Returns a copy of `value` with every sensitive key's value replaced by `[Redacted]`. */
export function redactSensitive(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) return redactSensitive(serializeError(value), seen);
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, seen));
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(child, seen);
  }
  return result;
}

export interface CreateLoggerOptions {
  level: LogLevel;
  /** Where JSON lines go; stdout by default. Tests pass an in-memory sink. */
  destination?: DestinationStream;
}

/**
 * Redacts each finished JSON line before it reaches `target`. This is the one place that sees
 * everything pino writes, including child-logger bindings, which skip pino's formatters.
 */
function redactingDestination(target: DestinationStream): DestinationStream {
  return {
    write(line: string) {
      let output = line;
      try {
        output = `${JSON.stringify(redactSensitive(JSON.parse(line)))}\n`;
      } catch {
        // Not a JSON line (should not happen with pino); drop it rather than risk a leak.
        return;
      }
      target.write(output);
    },
  };
}

export function createLogger({ level, destination }: CreateLoggerOptions): Logger {
  return pino(
    {
      level,
      formatters: {
        // Serializes errors at any depth (not only under `err`) and redacts the logged object.
        log: (obj: Record<string, unknown>) => redactSensitive(obj) as Record<string, unknown>,
      },
      // Errors are already serialized by the `log` formatter above.
      serializers: { err: (err: unknown) => err },
    },
    redactingDestination(destination ?? pino.destination({ dest: 1, sync: true }))
  );
}

/** Minimal surface of `process` used by the safety net, so tests can pass an EventEmitter. */
export interface ProcessLike {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown;
  on(event: 'uncaughtException', listener: (err: Error) => void): unknown;
}

/**
 * Last-resort safety net: no error should reach this layer, but if one does it is logged at
 * fatal. An unhandled rejection keeps the process alive; an uncaught exception leaves the
 * process in an unknown state, so it exits after logging.
 */
export function installProcessHandlers(
  proc: ProcessLike,
  logger: Logger,
  exit: (code: number) => void = (code) => process.exit(code)
): void {
  proc.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
  });
  proc.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    exit(1);
  });
}
