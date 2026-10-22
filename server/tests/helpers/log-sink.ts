import { createLogger, Logger } from '../../src/lib/logger.js';

export interface LogSink {
  /** Production logger (same redaction and format) writing into this sink. */
  logger: Logger;
  /** Every line written so far, parsed. */
  entries(): Record<string, any>[];
  /** Raw text of every line written so far. */
  text(): string;
}

/** An in-memory destination for the real logger, so tests can inspect what would be logged. */
export function createLogSink(): LogSink {
  const chunks: string[] = [];
  const logger = createLogger({
    level: 'trace',
    destination: { write: (chunk: string) => void chunks.push(chunk) },
  });
  const text = () => chunks.join('');
  return {
    logger,
    text,
    entries: () =>
      text()
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line)),
  };
}
