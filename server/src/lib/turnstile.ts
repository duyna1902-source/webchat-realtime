import type { TurnstileConfig } from '../config.js';

// ==========================================
// CLOUDFLARE TURNSTILE VERIFICATION
// ==========================================
// The widget in the browser only produces a token; the token proves nothing until the server
// redeems it with Cloudflare's siteverify endpoint. Each token is valid once and for 300 seconds.

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_TIMEOUT_MS = 5000;

/** Cloudflare's published test secret keys (always pass, always fail, token already spent). */
const CLOUDFLARE_TEST_SECRET_KEYS: ReadonlySet<string> = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

/** The form a token was issued for; the widget sends it as its `action`. */
export type CaptchaAction = 'login' | 'register';

export type CaptchaResult =
  | { outcome: 'ok' }
  /** Missing, invalid, expired, already used, or issued for another form. `reason` is for the log only. */
  | { outcome: 'invalid'; reason: string }
  /** Cloudflare could not be asked (network error, timeout, unexpected answer). */
  | { outcome: 'unavailable'; reason: string };

export interface CaptchaVerifier {
  verify(token: string | undefined, action: CaptchaAction, remoteIp: string | undefined): Promise<CaptchaResult>;
}

/** Used when Turnstile is not configured: every request passes, as before Turnstile existed. */
export const disabledCaptchaVerifier: CaptchaVerifier = {
  verify: async () => ({ outcome: 'ok' }),
};

export interface TurnstileVerifierOptions {
  config: TurnstileConfig;
  /** Injectable so tests never call Cloudflare. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface SiteverifyResponse {
  success?: unknown;
  action?: unknown;
  'error-codes'?: unknown;
}

export function createTurnstileVerifier({
  config,
  fetch: fetchImpl = (input, init) => fetch(input, init),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TurnstileVerifierOptions): CaptchaVerifier {
  return {
    async verify(token, action, remoteIp) {
      if (!token) return { outcome: 'invalid', reason: 'missing-input-response' };

      const body = new URLSearchParams({ secret: config.secretKey, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);

      let data: SiteverifyResponse;
      try {
        const res = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return { outcome: 'unavailable', reason: `http_${res.status}` };
        data = (await res.json()) as SiteverifyResponse;
      } catch (err) {
        const name = err instanceof Error ? err.name : 'unknown';
        return { outcome: 'unavailable', reason: name === 'TimeoutError' ? 'timeout' : 'network_error' };
      }

      if (data.success !== true) {
        const codes = Array.isArray(data['error-codes']) ? data['error-codes'].join(',') : '';
        // Cloudflare's own errors are not the visitor's fault: treat them as an outage.
        if (codes.includes('internal-error')) return { outcome: 'unavailable', reason: codes };
        return { outcome: 'invalid', reason: codes || 'rejected' };
      }
      // Cloudflare's test secret keys answer for a dummy token whose `action` is not documented.
      if (!CLOUDFLARE_TEST_SECRET_KEYS.has(config.secretKey) && data.action !== action) {
        return { outcome: 'invalid', reason: 'action_mismatch' };
      }
      return { outcome: 'ok' };
    },
  };
}
