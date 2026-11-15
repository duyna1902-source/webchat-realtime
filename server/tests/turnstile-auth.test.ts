import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createTestServer, TEST_APP_ORIGIN, TestServer } from './helpers/server.js';
import { createLogSink, LogSink } from './helpers/log-sink.js';
import { createTurnstileVerifier } from '../src/lib/turnstile.js';

// Sign-in and registration with Turnstile on: the server redeems the form's token with
// Cloudflare (faked here) before it looks at the account, and refuses when it cannot.

const TURNSTILE = { siteKey: '0x4AAAAAAAsitekey', secretKey: '0x4AAAAAAAsecretkey' };

/** Fake siteverify: `ok-<action>` passes for that form, `down` is an outage, anything else is rejected. */
const fakeCloudflare: typeof fetch = async (_url, init) => {
  const token = (init?.body as URLSearchParams).get('response') ?? '';
  if (token === 'down') throw new TypeError('fetch failed');
  const match = /^ok-(login|register)$/.exec(token);
  const body = match
    ? { success: true, action: match[1] }
    : { success: false, 'error-codes': ['invalid-input-response'] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

let server: TestServer;
let sink: LogSink;

beforeAll(async () => {
  sink = createLogSink();
  server = await createTestServer({
    config: {
      turnstile: TURNSTILE,
      rateLimits: {
        register: { max: 1000, windowMs: 60_000 },
        loginFailures: { max: 1000, windowMs: 60_000 },
      },
    },
    captcha: createTurnstileVerifier({ config: TURNSTILE, fetch: fakeCloudflare }),
    logger: sink.logger,
  });
});

afterAll(() => server.close());

const register = (body: Record<string, unknown>) =>
  request(server.app).post('/api/auth/register').set('Origin', TEST_APP_ORIGIN).send(body);
const login = (body: Record<string, unknown>) =>
  request(server.app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send(body);

const account = { username: 'tara', email: 'tara@example.com', password: 'Password123!' };

beforeEach(async () => {
  await register({ ...account, turnstileToken: 'ok-register' }).expect(201);
});

describe('Turnstile on sign-in and registration', () => {
  it('hands the public site key, never the secret, to the browser', async () => {
    const res = await request(server.app).get('/api/auth/config').expect(200);

    expect(res.body).toEqual({ turnstileSiteKey: TURNSTILE.siteKey });
    expect(JSON.stringify(res.body)).not.toContain(TURNSTILE.secretKey);
  });

  it('signs in with valid credentials and a valid token', async () => {
    const res = await login({ emailOrUsername: 'tara', password: account.password, turnstileToken: 'ok-login' }).expect(200);

    expect(res.body.user.username).toBe('tara');
  });

  it.each([
    ['without a token', {}],
    ['with a token Cloudflare rejects', { turnstileToken: 'forged' }],
    ['with a token issued for the registration form', { turnstileToken: 'ok-register' }],
  ])('refuses sign-in %s, even with the right password', async (_case, extra) => {
    const res = await login({ emailOrUsername: 'tara', password: account.password, ...extra }).expect(400);

    expect(res.body.code).toBe('CAPTCHA_FAILED');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('checks the token before the account, so a bot learns nothing about it', async () => {
    const res = await login({ emailOrUsername: 'nobody', password: 'whatever', turnstileToken: 'forged' }).expect(400);

    expect(res.body.code).toBe('CAPTCHA_FAILED');
    const events = sink.entries().map((entry) => entry.event);
    expect(events).toContain('auth.captcha.failure');
    expect(sink.entries().some((entry) => entry.event === 'auth.login.failure' && entry.identifier === 'nobody')).toBe(false);
  });

  it('refuses registration without a valid token and creates no account', async () => {
    const res = await register({ username: 'bot', email: 'bot@example.com', password: 'Password123!' }).expect(400);
    expect(res.body.code).toBe('CAPTCHA_FAILED');

    await register({
      username: 'bot',
      email: 'bot@example.com',
      password: 'Password123!',
      turnstileToken: 'ok-login',
    }).expect(400);

    // The name is still free: neither refused request created the account.
    await register({
      username: 'bot',
      email: 'bot@example.com',
      password: 'Password123!',
      turnstileToken: 'ok-register',
    }).expect(201);
  });

  it('fails closed with 503 when Cloudflare cannot be reached', async () => {
    const res = await login({ emailOrUsername: 'tara', password: account.password, turnstileToken: 'down' }).expect(503);

    expect(res.body.code).toBe('CAPTCHA_UNAVAILABLE');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('never logs the token or the secret key', async () => {
    await login({ emailOrUsername: 'tara', password: account.password, turnstileToken: 'forged-token-value' }).expect(400);

    expect(sink.text()).not.toContain('forged-token-value');
    expect(sink.text()).not.toContain(TURNSTILE.secretKey);
  });
});
