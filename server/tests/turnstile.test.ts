import { describe, it, expect, vi } from 'vitest';
import { createTurnstileVerifier, TURNSTILE_SITEVERIFY_URL } from '../src/lib/turnstile.js';

const config = { siteKey: 'site-key', secretKey: 'real-secret' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createTurnstileVerifier', () => {
  it('redeems the token with siteverify, sending the secret and the visitor IP', async () => {
    const fetch = vi.fn(async () => jsonResponse({ success: true, action: 'login' }));
    const verifier = createTurnstileVerifier({ config, fetch });

    await expect(verifier.verify('token-1', 'login', '203.0.113.7')).resolves.toEqual({ outcome: 'ok' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('real-secret');
    expect(body.get('response')).toBe('token-1');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('refuses a missing token without asking Cloudflare', async () => {
    const fetch = vi.fn();
    const verifier = createTurnstileVerifier({ config, fetch });

    await expect(verifier.verify(undefined, 'login', undefined)).resolves.toMatchObject({ outcome: 'invalid' });
    await expect(verifier.verify('', 'login', undefined)).resolves.toMatchObject({ outcome: 'invalid' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a token Cloudflare rejects (invalid, expired or already used)', async () => {
    const fetch = vi.fn(async () => jsonResponse({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
    const verifier = createTurnstileVerifier({ config, fetch });

    await expect(verifier.verify('used', 'login', undefined)).resolves.toEqual({
      outcome: 'invalid',
      reason: 'timeout-or-duplicate',
    });
  });

  it('refuses a token issued for the other form', async () => {
    const fetch = vi.fn(async () => jsonResponse({ success: true, action: 'register' }));
    const verifier = createTurnstileVerifier({ config, fetch });

    await expect(verifier.verify('token', 'login', undefined)).resolves.toEqual({
      outcome: 'invalid',
      reason: 'action_mismatch',
    });
  });

  it("skips the action check for Cloudflare's test secret keys, whose dummy token has no documented action", async () => {
    const fetch = vi.fn(async () => jsonResponse({ success: true, action: '' }));
    const verifier = createTurnstileVerifier({
      config: { siteKey: '1x00000000000000000000AA', secretKey: '1x0000000000000000000000000000000AA' },
      fetch,
    });

    await expect(verifier.verify('XXXX.DUMMY.TOKEN.XXXX', 'register', undefined)).resolves.toEqual({ outcome: 'ok' });
  });

  it.each([
    ['a network error', async () => Promise.reject(new TypeError('fetch failed')), 'network_error'],
    ['a timeout', async () => Promise.reject(new DOMException('timed out', 'TimeoutError')), 'timeout'],
    ['an HTTP error', async () => jsonResponse({}, 502), 'http_502'],
    ['an internal error', async () => jsonResponse({ success: false, 'error-codes': ['internal-error'] }), 'internal-error'],
  ])('reports Cloudflare as unavailable on %s', async (_case, impl, reason) => {
    const verifier = createTurnstileVerifier({ config, fetch: vi.fn(impl) as unknown as typeof fetch });

    await expect(verifier.verify('token', 'login', undefined)).resolves.toEqual({ outcome: 'unavailable', reason });
  });
});
