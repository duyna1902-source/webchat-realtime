// ==========================================
// CLOUDFLARE TURNSTILE
// ==========================================
// The browser solves the Turnstile widget and gets a one-time token; the server asks Cloudflare
// (Siteverify) whether that token is valid before it lets a register or login through.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare's own limit on a token's length; anything longer is refused without asking. */
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** How long to wait for Cloudflare before giving up (the request then answers `503`). */
export const TURNSTILE_TIMEOUT_MS = 5000;

export interface TurnstileResult {
  success: boolean;
  /** Cloudflare's reasons for a refusal, e.g. `invalid-input-response` or `timeout-or-duplicate`. */
  errorCodes: string[];
}

/**
 * Checks one token. Resolves with Cloudflare's answer; rejects only when Cloudflare could not be
 * asked (network error, timeout, non-2xx answer), so the caller can tell "bot" from "outage".
 */
export type TurnstileVerifier = (token: string, remoteIp?: string) => Promise<TurnstileResult>;

export interface TurnstileVerifierOptions {
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createTurnstileVerifier(secretKey: string, options: TurnstileVerifierOptions = {}): TurnstileVerifier {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? TURNSTILE_TIMEOUT_MS;

  return async (token, remoteIp) => {
    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Turnstile siteverify answered ${res.status}`);
    }

    const data = (await res.json()) as { success?: unknown; 'error-codes'?: unknown };
    const errorCodes = Array.isArray(data['error-codes'])
      ? data['error-codes'].filter((code): code is string => typeof code === 'string')
      : [];
    return { success: data.success === true, errorCodes };
  };
}
