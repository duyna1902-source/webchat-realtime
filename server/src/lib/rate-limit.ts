import type { RateLimitRule, RateLimitsConfig } from '../config.js';
import { RateLimitedError } from './errors.js';
import type { Logger } from './logger.js';
import { logSecurityEvent } from './security-events.js';

// ==========================================
// RATE LIMITING (SEC-07)
// ==========================================
// Every counter here (and the `express-rate-limit` MemoryStore used for REST) lives in this
// process's memory. That is correct only while the app runs as a single instance (Render free).
// Scaling horizontally requires moving these counters to a shared store (e.g. Redis); otherwise
// each instance allows the full limit on its own.

export type RateLimitName = keyof RateLimitsConfig;

/** One log line per rejected request or event, so abuse shows up in the logs. */
export function logRateLimitHit(log: Logger, limit: RateLimitName, retryAfterMs: number): void {
  logSecurityEvent(log, 'ratelimit.hit', { limit, retryAfterMs });
}

export type TakeResult = { allowed: true } | { allowed: false; retryAfterMs: number };

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * Token bucket per key: holds up to `max` tokens and refills `max` tokens per `windowMs`,
 * so a key can burst `max` events and then sustain `max / windowMs`.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly refillPerMs: number;
  private lastSweepAt: number;

  constructor(
    private readonly rule: RateLimitRule,
    private readonly now: () => number = Date.now
  ) {
    this.refillPerMs = rule.max / rule.windowMs;
    this.lastSweepAt = now();
  }

  /** Takes one token for `key`, or says how long until one is available. */
  take(key: string): TakeResult {
    const now = this.now();
    this.sweep(now);

    const bucket = this.buckets.get(key) ?? { tokens: this.rule.max, updatedAt: now };
    bucket.tokens = this.refilled(bucket, now);
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }
    return { allowed: false, retryAfterMs: Math.ceil((1 - bucket.tokens) / this.refillPerMs) };
  }

  private refilled(bucket: Bucket, now: number): number {
    return Math.min(this.rule.max, bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs);
  }

  /** Forgets keys whose bucket is full again, so memory only holds recently active keys. */
  private sweep(now: number): void {
    if (now - this.lastSweepAt < this.rule.windowMs) return;
    this.lastSweepAt = now;
    for (const [key, bucket] of this.buckets) {
      if (this.refilled(bucket, now) >= this.rule.max) this.buckets.delete(key);
    }
  }
}

/** The rate limits one connected socket is subject to. */
export interface SocketRateLimits {
  /** Counts one `direct:send` or `room:send`; throws `RateLimitedError` when over the limit. */
  consumeMessageSend(): void;
  /**
   * Whether a typing event for `conversation` should be broadcast. Excess events are dropped
   * silently. Only "started typing" events use the budget; a "stopped typing" event passes only
   * for a start that was broadcast, so it can neither flood nor leave a stale indicator behind.
   */
  allowTyping(conversation: string, isTyping: boolean): boolean;
}

/** Socket rate limiting for one server instance. Counters are per `userId`, across all of a User's sockets. */
export function createSocketRateLimiter(rules: Pick<RateLimitsConfig, 'messageSend' | 'typing'>) {
  const messageSend = new TokenBucketLimiter(rules.messageSend);
  const typing = new TokenBucketLimiter(rules.typing);

  return {
    /** Limits for one socket of `userId`. */
    forSocket(userId: string, log: Logger): SocketRateLimits {
      const broadcastTypingStarts = new Set<string>();

      return {
        consumeMessageSend() {
          const result = messageSend.take(userId);
          if (!result.allowed) {
            logRateLimitHit(log, 'messageSend', result.retryAfterMs);
            throw new RateLimitedError(result.retryAfterMs);
          }
        },
        allowTyping(conversation, isTyping) {
          if (!isTyping) return broadcastTypingStarts.delete(conversation);
          if (!typing.take(userId).allowed) return false;
          broadcastTypingStarts.add(conversation);
          return true;
        },
      };
    },
  };
}

export type SocketRateLimiter = ReturnType<typeof createSocketRateLimiter>;
