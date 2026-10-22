import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { createTestServer, TEST_APP_ORIGIN } from './helpers/server.js';

const SESSION_COOKIE = '__Host-session';

/** The `__Host-session` Set-Cookie line of a response, or undefined. */
function sessionSetCookie(res: request.Response): string | undefined {
  const lines = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return lines.find((line) => line.startsWith(`${SESSION_COOKIE}=`));
}

function cookieAttributes(setCookie: string): string[] {
  return setCookie.split(';').slice(1).map((part) => part.trim().toLowerCase());
}

let app: Express;

beforeAll(async () => {
  ({ app } = await createTestServer());
});

describe('Session cookie login (SEC-11, ADR 0010)', () => {
  it('register sets an HttpOnly, Secure, SameSite=Strict __Host-session cookie and returns { user } without a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_APP_ORIGIN)
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' })
      .expect(201);

    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ username: 'alice', email: 'alice@example.com' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const setCookie = sessionSetCookie(res);
    expect(setCookie).toBeDefined();
    const value = setCookie!.split(';')[0].slice(SESSION_COOKIE.length + 1);
    // 32 random bytes, base64url-encoded
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookieAttributes(setCookie!)).toEqual(
      expect.arrayContaining(['httponly', 'secure', 'samesite=strict', 'path=/', 'max-age=2592000'])
    );
    expect(cookieAttributes(setCookie!).some((attr) => attr.startsWith('domain='))).toBe(false);
  });

  it('login sets the same cookie and returns { user } without a token', async () => {
    await register('bob');

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_APP_ORIGIN)
      .send({ emailOrUsername: 'bob', password: 'password123' })
      .expect(200);

    expect(res.body).toEqual({ user: expect.objectContaining({ username: 'bob', email: 'bob@example.com' }) });
    expect(cookieAttributes(sessionSetCookie(res)!)).toEqual(
      expect.arrayContaining(['httponly', 'secure', 'samesite=strict', 'path=/', 'max-age=2592000'])
    );
  });

  it('every login gets a different Session token', async () => {
    const first = await register('carol');
    const second = await login('carol');

    expect(second).not.toBe(first);
  });

  it('GET /api/auth/me returns 401 without a cookie and 200 { user } with one', async () => {
    await request(app).get('/api/auth/me').expect(401);

    const cookie = await register('dave');
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);

    expect(res.body).toEqual({ user: expect.objectContaining({ username: 'dave', email: 'dave@example.com' }) });
  });

  it('POST /api/auth/logout returns 204, clears the cookie, and /me is 401 afterwards', async () => {
    const cookie = await register('erin');
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);

    const res = await request(app).post('/api/auth/logout').set('Origin', TEST_APP_ORIGIN).set('Cookie', cookie).expect(204);

    const cleared = sessionSetCookie(res);
    expect(cleared).toBeDefined();
    expect(cleared!.split(';')[0]).toBe(`${SESSION_COOKIE}=`);
    expect(cookieAttributes(cleared!)).toEqual(expect.arrayContaining(['path=/', 'secure', 'httponly']));
    expect(cookieAttributes(cleared!).some((attr) => attr.startsWith('expires=thu, 01 jan 1970'))).toBe(true);

    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('A13: the old cookie is rejected after logout, on every REST endpoint', async () => {
    const cookie = await register('frank');
    await request(app).post('/api/auth/logout').set('Origin', TEST_APP_ORIGIN).set('Cookie', cookie).expect(204);

    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
    await request(app).get('/api/rooms').set('Cookie', cookie).expect(401);
    await request(app).post('/api/rooms').set('Origin', TEST_APP_ORIGIN).set('Cookie', cookie).send({ name: 'x' }).expect(401);
  });

  it('logging out one Session leaves another Session of the same User working', async () => {
    const laptop = await register('gina');
    const phone = await login('gina');

    await request(app).post('/api/auth/logout').set('Origin', TEST_APP_ORIGIN).set('Cookie', laptop).expect(204);

    await request(app).get('/api/auth/me').set('Cookie', laptop).expect(401);
    await request(app).get('/api/auth/me').set('Cookie', phone).expect(200);
  });

  it('a random cookie value is rejected', async () => {
    await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${'A'.repeat(43)}`).expect(401);
  });

  it('A12: a token self-signed with the old JWT_SECRET no longer works, as Bearer or as cookie', async () => {
    const user = (await request(app)
      .post('/api/auth/register')
      .set('Origin', TEST_APP_ORIGIN)
      .send({ username: 'henry', email: 'henry@example.com', password: 'password123' })
      .expect(201)).body.user;

    for (const secret of [LEAKED_DEFAULT_JWT_SECRET, OLD_TEST_JWT_SECRET]) {
      const forged = forgeJwt({ userId: user.id, username: user.username }, secret);

      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
      await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${forged}`).expect(401);
    }
  });
});

describe('Session expiry (7 days idle, 30 days absolute)', () => {
  const MINUTE = 60 * 1000;
  const DAY = 24 * 60 * MINUTE;
  let clock: number;

  beforeEach(() => {
    // Only Date is faked: the server's timers and I/O keep running for real.
    vi.useFakeTimers({ toFake: ['Date'] });
    clock = Date.parse('2026-10-01T00:00:00Z');
    vi.setSystemTime(clock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(ms: number) {
    clock += ms;
    vi.setSystemTime(clock);
  }

  const me = (cookie: string) => request(app).get('/api/auth/me').set('Cookie', cookie);

  it('expires after 7 days without activity', async () => {
    const cookie = await register('olga');

    advance(7 * DAY - MINUTE);
    await me(cookie).expect(200);

    advance(7 * DAY);
    await me(cookie).expect(401);
    // Gone for good, not just this once.
    advance(-7 * DAY);
    await me(cookie).expect(401);
  });

  it('activity keeps a Session alive, but never past 30 days from login', async () => {
    const cookie = await register('pete');

    for (let day = 6; day < 30; day += 6) {
      advance(6 * DAY);
      await me(cookie).expect(200);
    }
    // Day 24 now; last activity just now.
    advance(6 * DAY - MINUTE);
    await me(cookie).expect(200);

    advance(MINUTE);
    await me(cookie).expect(401);
  });

  it('writes lastActiveAt at most once every few minutes, not on every request', async () => {
    const cookie = await register('quinn');

    // Too soon after login to count as new activity.
    advance(2 * MINUTE);
    await me(cookie).expect(200);

    // 7 days after login, though less than 7 days after the last request.
    advance(7 * DAY - 2 * MINUTE);
    await me(cookie).expect(401);
  });
});

describe('Cross-site request rejection (CSRF, Q44)', () => {
  it('a POST without Origin and without Sec-Fetch-Site is 403, even for auth', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ivan', email: 'ivan@example.com', password: 'password123' })
      .expect(403);

    expect(res.body.code).toBe('FORBIDDEN');
    expect(sessionSetCookie(res)).toBeUndefined();
  });

  it('a POST from another Origin is 403, even with a valid Session cookie', async () => {
    const cookie = await register('judy');

    await request(app).post('/api/rooms').set('Origin', 'https://evil.example').set('Cookie', cookie).send({ name: 'pwned' }).expect(403);
    await request(app).post('/api/auth/logout').set('Origin', 'https://evil.example').set('Cookie', cookie).expect(403);
    // The Session survived the forged logout.
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
  });

  it.each(['PATCH', 'PUT', 'DELETE'] as const)('a %s from another Origin is 403', async (method) => {
    const cookie = await register(`kim_${method.toLowerCase()}`);
    const agent = request(app)[method.toLowerCase() as 'patch' | 'put' | 'delete']('/api/rooms/some-room');

    await agent.set('Origin', 'http://localhost:5174').set('Cookie', cookie).expect(403);
  });

  it('an Origin that only looks like APP_ORIGIN is 403', async () => {
    for (const origin of [`${TEST_APP_ORIGIN}.evil.example`, TEST_APP_ORIGIN.replace('http:', 'https:'), 'null']) {
      await request(app)
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ emailOrUsername: 'nobody', password: 'password123' })
        .expect(403);
    }
  });

  it('without Origin, Sec-Fetch-Site: same-origin is accepted and anything else is 403', async () => {
    const body = { username: 'leo', email: 'leo@example.com', password: 'password123' };
    for (const site of ['cross-site', 'same-site', 'none']) {
      await request(app).post('/api/auth/register').set('Sec-Fetch-Site', site).send(body).expect(403);
    }
    await request(app).post('/api/auth/register').set('Sec-Fetch-Site', 'same-origin').send(body).expect(201);
  });

  it('a multipart upload from another Origin is 403', async () => {
    const cookie = await register('mia');

    await request(app)
      .post('/api/upload')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' })
      .expect(403);
  });

  it('GET requests need no Origin', async () => {
    const cookie = await register('ned');

    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
  });
});

/** Registers `<name>` / `<name>@example.com` and returns the `Cookie` header for its Session. */
async function register(name: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Origin', TEST_APP_ORIGIN)
    .send({ username: name, email: `${name}@example.com`, password: 'password123' })
    .expect(201);
  return sessionSetCookie(res)!.split(';')[0];
}

async function login(name: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', TEST_APP_ORIGIN)
    .send({ emailOrUsername: name, password: 'password123' })
    .expect(200);
  return sessionSetCookie(res)!.split(';')[0];
}

/** The fallback secret leaked in the audit (SEC-02), and the secret the tests used to sign with. */
const LEAKED_DEFAULT_JWT_SECRET = 'webchat-realtime-default-secret-key-32-chars';
const OLD_TEST_JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';

/** An HS256 JWT built by hand, the way an attacker holding the secret would (A12). */
function forgeJwt(payload: Record<string, unknown>, secret: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...payload, iat: now, exp: now + 3600 })}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}
