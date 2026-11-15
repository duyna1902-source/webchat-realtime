import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import { ERROR_CODES } from '@webchat/shared';
import { getPrisma } from '../src/lib/prisma.js';
import {
  createTurnstileVerifier,
  TURNSTILE_SITEVERIFY_URL,
  TURNSTILE_TOKEN_MAX_LENGTH,
  TurnstileResult,
  TurnstileVerifier,
} from '../src/lib/turnstile.js';
import { createLogSink, LogSink } from './helpers/log-sink.js';
import { createTestServer, TEST_APP_ORIGIN, TestServer, TestConfigOverrides } from './helpers/server.js';

// Cloudflare Turnstile is enforced on the server: register and login need a token Cloudflare accepts.

const SITE_KEY = '1x00000000000000000000AA';
const SECRET_KEY = '1x0000000000000000000000000000000AA';
const GOOD_TOKEN = 'good-token';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createTurnstileVerifier', () => {
  it('posts the secret, the token and the client IP to Siteverify', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true, 'error-codes': [] }));
    const verify = createTurnstileVerifier(SECRET_KEY, { fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(verify('the-token', '203.0.113.7')).resolves.toEqual({ success: true, errorCodes: [] });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe(SECRET_KEY);
    expect(body.get('response')).toBe('the-token');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it("returns Cloudflare's refusal and its error codes", async () => {
    const fetchImpl = async () => jsonResponse({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    const verify = createTurnstileVerifier(SECRET_KEY, { fetchImpl: fetchImpl as typeof fetch });

    await expect(verify('used-token')).resolves.toEqual({ success: false, errorCodes: ['timeout-or-duplicate'] });
  });

  it('treats anything but `success: true` as a refusal', async () => {
    const fetchImpl = async () => jsonResponse({ success: 'true' });
    const verify = createTurnstileVerifier(SECRET_KEY, { fetchImpl: fetchImpl as typeof fetch });

    await expect(verify('token')).resolves.toEqual({ success: false, errorCodes: [] });
  });

  it('rejects when Cloudflare answers with an HTTP error', async () => {
    const fetchImpl = async () => jsonResponse({}, 500);
    const verify = createTurnstileVerifier(SECRET_KEY, { fetchImpl: fetchImpl as typeof fetch });

    await expect(verify('token')).rejects.toThrow(/500/);
  });

  it('rejects when Cloudflare does not answer in time', async () => {
    // Never answers; only the abort signal ends the request.
    const fetchImpl = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const verify = createTurnstileVerifier(SECRET_KEY, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 20,
    });

    await expect(verify('token')).rejects.toBeDefined();
  });
});

describe('Turnstile on register and login', () => {
  let server: TestServer | undefined;
  let sink: LogSink;

  afterEach(async () => {
    vi.unstubAllGlobals();
    await server?.close();
    server = undefined;
  });

  /** A fake Cloudflare: accepts `GOOD_TOKEN` only, or answers with `answer` when given. */
  async function start(answer?: (token: string) => Promise<TurnstileResult>, config: TestConfigOverrides = {}) {
    const fakeCloudflare: TurnstileVerifier = async (token) =>
      token === GOOD_TOKEN ? { success: true, errorCodes: [] } : { success: false, errorCodes: ['invalid-input-response'] };
    const verify = vi.fn(answer ?? fakeCloudflare);
    sink = createLogSink();
    server = await createTestServer({
      config: { turnstileSiteKey: SITE_KEY, turnstileSecretKey: SECRET_KEY, ...config },
      logger: sink.logger,
      verifyTurnstile: verify,
    });
    return { verify };
  }

  const account = { username: 'captcha_user', email: 'captcha@example.com', password: 'Password123!' };

  function register(body: Record<string, unknown>) {
    return request(server!.app).post('/api/auth/register').set('Origin', TEST_APP_ORIGIN).send(body);
  }

  function login(body: Record<string, unknown>) {
    return request(server!.app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send(body);
  }

  function captchaEvents(): Record<string, any>[] {
    return sink.entries().filter((entry) => entry.event === 'auth.captcha.failure');
  }

  it('refuses a registration without a token, before asking Cloudflare or creating the account', async () => {
    const { verify } = await start();

    const res = await register(account).expect(400);

    expect(res.body).toMatchObject({ code: ERROR_CODES.CAPTCHA_FAILED });
    expect(res.body).toHaveProperty('requestId');
    expect(verify).not.toHaveBeenCalled();
    expect(await getPrisma().user.count()).toBe(0);
    expect(captchaEvents()).toEqual([expect.objectContaining({ reason: 'missing_token', path: '/api/auth/register' })]);
  });

  it('refuses a registration whose token Cloudflare rejects, and logs why', async () => {
    const { verify } = await start();

    const res = await register({ ...account, turnstileToken: 'forged' }).expect(400);

    expect(res.body).toMatchObject({ code: ERROR_CODES.CAPTCHA_FAILED });
    expect(verify).toHaveBeenCalledWith('forged', expect.any(String));
    expect(await getPrisma().user.count()).toBe(0);
    expect(captchaEvents()).toEqual([
      expect.objectContaining({ reason: 'rejected', errorCodes: 'invalid-input-response' }),
    ]);
    // The token is a credential of sorts: it never goes into the log.
    expect(sink.text()).not.toContain('forged');
  });

  it('registers when Cloudflare accepts the token', async () => {
    const { verify } = await start();

    const res = await register({ ...account, turnstileToken: GOOD_TOKEN }).expect(201);

    expect(res.body.user).toMatchObject({ username: 'captcha_user' });
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('refuses an oversized token without asking Cloudflare', async () => {
    const { verify } = await start();

    await register({ ...account, turnstileToken: 'x'.repeat(TURNSTILE_TOKEN_MAX_LENGTH + 1) }).expect(400);

    expect(verify).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when Cloudflare cannot be reached', async () => {
    await start(async () => {
      throw new Error('getaddrinfo ENOTFOUND challenges.cloudflare.com');
    });

    const res = await register({ ...account, turnstileToken: GOOD_TOKEN }).expect(503);

    expect(res.body).toMatchObject({ code: ERROR_CODES.CAPTCHA_UNAVAILABLE });
    expect(JSON.stringify(res.body)).not.toContain('ENOTFOUND');
    expect(await getPrisma().user.count()).toBe(0);
  });

  it('checks the token on login before the password', async () => {
    await start();
    await register({ ...account, turnstileToken: GOOD_TOKEN }).expect(201);
    const { username, password } = account;

    const noToken = await login({ emailOrUsername: username, password }).expect(400);
    expect(noToken.body).toMatchObject({ code: ERROR_CODES.CAPTCHA_FAILED });

    // The right password does not help without a token Cloudflare accepts.
    const rejected = await login({ emailOrUsername: username, password, turnstileToken: 'forged' }).expect(400);
    expect(rejected.body).toMatchObject({ code: ERROR_CODES.CAPTCHA_FAILED });

    await login({ emailOrUsername: username, password: 'Wrong-password1', turnstileToken: GOOD_TOKEN }).expect(401);
  });

  it('logs in with a valid token and the right password', async () => {
    await start();
    await register({ ...account, turnstileToken: GOOD_TOKEN }).expect(201);

    await login({ emailOrUsername: account.username, password: account.password, turnstileToken: GOOD_TOKEN }).expect(200);
  });

  it('applies the rate limit before Turnstile, so a bot cannot make the server call Cloudflare without limit', async () => {
    const { verify } = await start(undefined, { rateLimits: { register: { max: 2, windowMs: 60_000 } } });

    await register({ ...account, turnstileToken: 'forged-1' }).expect(400);
    await register({ ...account, turnstileToken: 'forged-2' }).expect(400);
    await register({ ...account, turnstileToken: 'forged-3' }).expect(429);

    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('asks the real Siteverify endpoint with the configured secret when no verifier is injected', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ success: true, 'error-codes': [] }));
    vi.stubGlobal('fetch', fetchSpy);
    sink = createLogSink();
    server = await createTestServer({
      config: { turnstileSiteKey: SITE_KEY, turnstileSecretKey: SECRET_KEY },
      logger: sink.logger,
    });

    await register({ ...account, turnstileToken: 'browser-token' }).expect(201);

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect((init.body as URLSearchParams).get('secret')).toBe(SECRET_KEY);
    expect((init.body as URLSearchParams).get('response')).toBe('browser-token');
  });
});
