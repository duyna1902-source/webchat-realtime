import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { io as ClientSocket } from 'socket.io-client';
import sharp from 'sharp';
import { MAX_UPLOAD_BYTES } from '../src/middlewares/upload.middleware.js';
import {
  createTestServer,
  createLoggedInUser,
  sessionCookieOf,
  sessionHeaders,
  TestServer,
  TestConfigOverrides,
  TEST_APP_ORIGIN,
} from './helpers/server.js';
import { createLogSink, LogSink } from './helpers/log-sink.js';

// SEC-17: security-relevant events are written as structured JSON log lines (field `event`),
// bound to the request (`requestId`, `ip`, `userId` when known), and never carry secrets.

let sink: LogSink;
let server: TestServer;

async function startServer(config?: TestConfigOverrides): Promise<TestServer> {
  server = await createTestServer({ config, logger: sink.logger });
  return server;
}

beforeEach(() => {
  sink = createLogSink();
});

afterEach(async () => {
  await server?.close();
});

/** Log lines of security events, in the order they were written. */
function events(name?: string): Record<string, any>[] {
  return sink.entries().filter((entry) => typeof entry.event === 'string' && (name === undefined || entry.event === name));
}

function login(emailOrUsername: string, password: string) {
  return request(server.app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send({ emailOrUsername, password });
}

describe('Security events: authentication', () => {
  it('A08: repeated wrong passwords log auth.login.failure with the normalized identifier, then ratelimit.hit', async () => {
    await startServer({ rateLimits: { loginFailures: { max: 3, windowMs: 60_000 } } });
    await createLoggedInUser(server.app, { username: 'bob' });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await login(' BOB ', `wrong-${attempt}`).expect(401);
    }
    await login('bob', 'wrong-4').expect(429);

    const sequence = events()
      .filter((entry) => entry.event === 'auth.login.failure' || entry.event === 'ratelimit.hit')
      .map((entry) => entry.event);
    expect(sequence).toEqual(['auth.login.failure', 'auth.login.failure', 'auth.login.failure', 'ratelimit.hit']);

    const [failure] = events('auth.login.failure');
    expect(failure.identifier).toBe('bob');
    expect(failure.requestId).toEqual(expect.any(String));
    expect(failure.ip).toEqual(expect.any(String));
    expect(events('ratelimit.hit')[0].limit).toBe('loginFailures');
  });

  it('logs register, login success, logout and logout everywhere with the User, and every revocation', async () => {
    await startServer();

    const registered = await request(server.app)
      .post('/api/auth/register').set('Origin', TEST_APP_ORIGIN)
      .send({ username: 'carol', email: 'carol@example.com', password: 'Carol-Secret-Pass-1' })
      .expect(201);
    const userId = registered.body.user.id;
    const registerCookie = sessionCookieOf(registered);

    const loggedIn = await login('carol', 'Carol-Secret-Pass-1').expect(200);
    const loginCookie = sessionCookieOf(loggedIn);

    await request(server.app).post('/api/auth/logout').set(sessionHeaders(registerCookie)).expect(204);
    await request(server.app).post('/api/auth/logout-all').set(sessionHeaders(loginCookie)).expect(204);

    expect(events('auth.register')).toEqual([expect.objectContaining({ userId })]);
    expect(events('auth.login.success')).toEqual([expect.objectContaining({ userId })]);
    expect(events('auth.logout')).toEqual([expect.objectContaining({ userId })]);
    expect(events('auth.logout_all')).toEqual([expect.objectContaining({ userId, revoked: 1 })]);
    expect(events('session.revoked')).toEqual([
      expect.objectContaining({ scope: 'session', userId, count: 1 }),
      expect.objectContaining({ scope: 'user', userId, count: 1 }),
    ]);
  });
});

describe('Security events: uploads', () => {
  it('logs upload.rejected with the reason for an SVG and a file over the size limit, and upload.accepted for a PNG', async () => {
    await startServer();
    const { user, headers } = await createLoggedInUser(server.app, { username: 'uploader' });
    const upload = (data: Buffer, filename: string, contentType: string) =>
      request(server.app).post('/api/upload').set(headers).attach('file', data, { filename, contentType });

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await upload(svg, 'poc.svg', 'image/svg+xml').expect(415);
    await upload(Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'big.bin', 'application/octet-stream').expect(413);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } }).png().toBuffer();
    await upload(png, 'ok.png', 'image/png').expect(201);

    expect(events('upload.rejected')).toEqual([
      expect.objectContaining({ userId: user.id, reason: 'unsupported_type' }),
      expect.objectContaining({ userId: user.id, reason: 'too_large' }),
    ]);
    expect(events('upload.accepted')).toEqual([
      expect.objectContaining({ userId: user.id, kind: 'IMAGE', mimeType: 'image/png', size: expect.any(Number) }),
    ]);
  });
});

describe('Security events: room administration', () => {
  it('logs kick, role change, leave and delete with the acting User, the room and the target', async () => {
    await startServer();
    const owner = await createLoggedInUser(server.app, { username: 'owner' });
    const kicked = await createLoggedInUser(server.app, { username: 'kicked' });
    const promoted = await createLoggedInUser(server.app, { username: 'promoted' });
    const room = await request(server.app).post('/api/rooms').set(owner.headers).send({ name: 'Team' }).expect(201);
    const roomId = room.body.id;
    for (const member of [kicked, promoted]) {
      await request(server.app).post(`/api/rooms/${roomId}/members`).set(owner.headers).send({ userId: member.user.id }).expect(201);
    }

    await request(server.app).delete(`/api/rooms/${roomId}/members/${kicked.user.id}`).set(owner.headers).expect(200);
    await request(server.app).patch(`/api/rooms/${roomId}/members/${promoted.user.id}/role`).set(owner.headers).send({ role: 'ADMIN' }).expect(200);
    await request(server.app).post(`/api/rooms/${roomId}/leave`).set(promoted.headers).expect(200);
    await request(server.app).delete(`/api/rooms/${roomId}`).set(owner.headers).expect(200);

    expect(events('room.member.kicked')).toEqual([
      expect.objectContaining({ userId: owner.user.id, roomId, targetUserId: kicked.user.id, targetRole: 'MEMBER' }),
    ]);
    expect(events('room.member.role_changed')).toEqual([
      expect.objectContaining({ userId: owner.user.id, roomId, targetUserId: promoted.user.id, fromRole: 'MEMBER', toRole: 'ADMIN' }),
    ]);
    expect(events('room.left')).toEqual([expect.objectContaining({ userId: promoted.user.id, roomId, role: 'ADMIN' })]);
    expect(events('room.deleted')).toEqual([expect.objectContaining({ userId: owner.user.id, roomId })]);
  });
});

describe('Security events: refused requests and connections', () => {
  it('logs http.401 and http.403 with the method and path, and the User when known', async () => {
    await startServer();
    const { headers } = await createLoggedInUser(server.app, { username: 'erin' });
    const room = await request(server.app).post('/api/rooms').set(headers).send({ name: 'Private' }).expect(201);
    const outsider = await createLoggedInUser(server.app, { username: 'frank' });

    await request(server.app).get('/api/auth/me').expect(401);
    await request(server.app).post('/api/auth/logout-all').set('Cookie', headers.Cookie).set('Origin', 'https://evil.example').expect(403);
    await request(server.app).get(`/api/rooms/${room.body.id}?probe=1`).set(outsider.headers).expect(403);

    expect(events('http.401')).toEqual([expect.objectContaining({ method: 'GET', path: '/api/auth/me' })]);
    expect(events('http.403')).toEqual([
      expect.objectContaining({ method: 'POST', path: '/api/auth/logout-all' }),
      expect.objectContaining({ method: 'GET', path: `/api/rooms/${room.body.id}`, userId: outsider.user.id }),
    ]);
  });

  it('logs socket.handshake.rejected for a foreign Origin and for a missing Session', async () => {
    await createTestServer({ logger: sink.logger, listen: true }).then((started) => (server = started));
    const url = `http://localhost:${server.port}`;

    const attempt = (extraHeaders: Record<string, string>) =>
      new Promise<string>((resolve) => {
        const client = ClientSocket(url, { transports: ['websocket'], extraHeaders, reconnection: false });
        client.on('connect_error', (err) => {
          client.disconnect();
          resolve(err.message);
        });
      });

    await attempt({ Origin: 'https://evil.example' });
    await attempt({ Origin: TEST_APP_ORIGIN, Cookie: '__Host-session=forged-token-value' });

    expect(events('socket.handshake.rejected')).toEqual([
      expect.objectContaining({ reason: 'forbidden_origin', origin: 'https://evil.example', ip: expect.any(String) }),
      expect.objectContaining({ reason: 'no_session', ip: expect.any(String) }),
    ]);
    expect(sink.text()).not.toContain('forged-token-value');
  });
});

describe('Security events: no secrets in the log', () => {
  it('never writes a password or a Session cookie value, even when a request with a password fails', async () => {
    await startServer();
    const password = 'Very-Secret-Pass-42';

    const registered = await request(server.app)
      .post('/api/auth/register').set('Origin', TEST_APP_ORIGIN)
      .send({ username: 'dave', email: 'dave@example.com', password })
      .expect(201);
    const cookie = sessionCookieOf(registered);
    const loggedIn = await login('dave@example.com', password).expect(200);
    await login('dave', `${password}-wrong`).expect(401);
    // Malformed JSON and a body over the limit, both carrying the password.
    await request(server.app)
      .post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).set('Content-Type', 'application/json')
      .send(`{"emailOrUsername":"dave","password":"${password}"`)
      .expect(400);
    await request(server.app)
      .post('/api/auth/login').set('Origin', TEST_APP_ORIGIN)
      .send({ emailOrUsername: 'dave', password, padding: 'x'.repeat(200 * 1024) })
      .expect(413);
    // A cross-site request and a bad cookie, both with the cookie attached.
    await request(server.app).post('/api/auth/logout-all').set('Cookie', cookie).set('Origin', 'https://evil.example').expect(403);
    await request(server.app).get('/api/auth/me').set('Cookie', `${cookie}x`).expect(401);
    await request(server.app).post('/api/auth/logout-all').set(sessionHeaders(sessionCookieOf(loggedIn))).expect(204);

    const text = sink.text();
    expect(events().length).toBeGreaterThan(0);
    expect(text).not.toContain(password);
    for (const value of [cookie, sessionCookieOf(loggedIn)].map((pair) => pair.split('=')[1])) {
      expect(text).not.toContain(value);
    }
  });
});
