import { ERROR_CODES, formatRateLimitMessage, SocketErrorAck } from '@webchat/shared';

/** What the server acks to `direct:send` / `room:send`. */
export type SendMessageAck = { success: true } | SocketErrorAck;

/** "Too many requests. Try again in N seconds." for a `RATE_LIMITED` socket ack, otherwise null. */
export function rateLimitNoticeFromAck(ack: unknown): string | null {
  const candidate = ack as Partial<SocketErrorAck> | null | undefined;
  if (candidate?.success !== false || candidate.error !== ERROR_CODES.RATE_LIMITED) return null;
  return formatRateLimitMessage(candidate.retryAfterMs ?? 0);
}

/**
 * The message to show for a failed REST response. A `429` always says how long to wait, from the
 * body's `retryAfterMs` or else the `Retry-After` header (seconds).
 */
export async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (res.status === 429) {
    const retryAfterMs =
      typeof body?.retryAfterMs === 'number' ? body.retryAfterMs : Number(res.headers?.get('Retry-After') ?? 0) * 1000;
    return formatRateLimitMessage(Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
  }
  return typeof body?.message === 'string' && body.message ? body.message : fallback;
}
