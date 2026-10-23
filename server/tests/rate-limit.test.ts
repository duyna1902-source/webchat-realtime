import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createTestServer, loginAs, TestServer, TestConfigOverrides, TEST_APP_ORIGIN } from './helpers/server.js';
import { createLogSink } from './helpers/log-sink.js';
import { getPrisma } from '../src/lib/prisma.js';
import { ERROR_CODES, SOCKET_EVENTS, RoomRole, normalizeDirectChatPair } from '@webchat/shared';

// SEC-07: every endpoint an attacker can hammer is rate limited. Thresholds are the spec
// defaults unless a test overrides them to stay fast.

/** Time allowed for a broadcast that should NOT arrive, after the events before it already did. */
const SILENCE_MS = 200;

const servers: TestServer[] = [];
const clients: ClientSocketType[] = [];

async function startServer(config?: TestConfigOverrides, listen = false): Promise<TestServer> {
  const server = await createTestServer({ config, listen });
  servers.push(server);
  return server;
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const server of servers.splice(0)) {
    await server.close();
  }
});

async function createUser(username: string, password = 'Password123!') {
  return getPrisma().user.create({
    data: { username, email: `${username}@example.com`, passwordHash: await bcrypt.hash(password, 4) },
  });
}

describe('Rate limiting: login (SEC-07)', () => {
  it('A08: the 11th failed login for the same IP and identifier gets 429 with Retry-After', async () => {
    const { app } = await startServer();
    await createUser('alice');

    for (let attempt = 1; attempt <= 10; attempt++) {
      await request(app)
        .post('/api/auth/login').set('Origin', TEST_APP_ORIGIN)
        .send({ emailOrUsername: 'alice', password: `wrong-${attempt}` })
        .expect(401);
    }

    const res = await request(app)
      .post('/api/auth/login').set('Origin', TEST_APP_ORIGIN)
      .send({ emailOrUsername: 'alice', password: 'wrong-11' })
      .expect(429);

    const retryAfterSeconds = Number(res.headers['retry-after']);
    expect(retryAfterSeconds).toBeGreaterThan(0);
    expect(retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
    expect(res.body.code).toBe(ERROR_CODES.RATE_LIMITED);
  });

  it('counts the identifier case-insensitively, and blocks even the right password once over the limit', async () => {
    const { app } = await startServer({ rateLimits: { loginFailures: { max: 2, windowMs: 60_000 } } });
    await createUser('alice');

    await request(app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send({ emailOrUsername: 'alice', password: 'wrong' }).expect(401);
    await request(app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send({ emailOrUsername: 'ALICE', password: 'wrong' }).expect(401);
    await request(app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send({ emailOrUsername: ' Alice ', password: 'Password123!' }).expect(429);
  });

  it('does not count successful logins', async () => {
    const { app } = await startServer({ rateLimits: { loginFailures: { max: 2, windowMs: 60_000 } } });
    await createUser('alice');

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send({ emailOrUsername: 'alice', password: 'Password123!' }).expect(200);
    }
    await request(app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send({ emailOrUsername: 'alice', password: 'wrong' }).expect(401);
  });

  it('keys on the real client IP behind the proxy (trust proxy), not on the proxy address', async () => {
    const { app } = await startServer({ rateLimits: { loginFailures: { max: 2, windowMs: 60_000 } } });
    await createUser('alice');
    const fromAttacker = () =>
      request(app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).set('X-Forwarded-For', '203.0.113.7').send({ emailOrUsername: 'alice', password: 'wrong' });

    await fromAttacker().expect(401);
    await fromAttacker().expect(401);
    await fromAttacker().expect(429);

    await request(app)
      .post('/api/auth/login').set('Origin', TEST_APP_ORIGIN)
      .set('X-Forwarded-For', '198.51.100.20')
      .send({ emailOrUsername: 'alice', password: 'Password123!' })
      .expect(200);
  });
});

describe('Rate limiting: logging (SEC-07)', () => {
  it('logs each rejected request as ratelimit.hit with the limit name and the client IP', async () => {
    const sink = createLogSink();
    const server = await createTestServer({ config: { rateLimits: { register: { max: 1, windowMs: 60_000 } } }, logger: sink.logger });
    servers.push(server);
    const register = (n: number) =>
      request(server.app)
        .post('/api/auth/register').set('Origin', TEST_APP_ORIGIN)
        .set('X-Forwarded-For', '203.0.113.7')
        .send({ username: `bot${n}`, email: `bot${n}@example.com`, password: 'Password123!' });

    await register(1).expect(201);
    await register(2).expect(429);

    const hits = sink.entries().filter((entry) => entry.event === 'ratelimit.hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ limit: 'register', ip: '203.0.113.7' });
  });
});

describe('Rate limiting: register (SEC-07)', () => {
  it('allows 5 registrations per IP per hour, then answers 429 with Retry-After', async () => {
    const { app } = await startServer();
    const register = (n: number) =>
      request(app)
        .post('/api/auth/register').set('Origin', TEST_APP_ORIGIN)
        .send({ username: `bot${n}`, email: `bot${n}@example.com`, password: 'Password123!' });

    for (let n = 1; n <= 5; n++) {
      await register(n).expect(201);
    }
    const res = await register(6).expect(429);

    const retryAfterSeconds = Number(res.headers['retry-after']);
    expect(retryAfterSeconds).toBeGreaterThan(15 * 60);
    expect(retryAfterSeconds).toBeLessThanOrEqual(60 * 60);
    expect(res.body).toMatchObject({ code: ERROR_CODES.RATE_LIMITED, message: expect.stringMatching(/try again in 1 hour/i) });
  });
});

function expectRateLimited(res: request.Response): void {
  expect(res.status).toBe(429);
  expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  expect(res.body.code).toBe(ERROR_CODES.RATE_LIMITED);
  expect(res.body.retryAfterMs).toBeGreaterThan(0);
}

describe('Rate limiting: per-User REST endpoints (SEC-07)', () => {
  const tight = { max: 2, windowMs: 60_000 };

  it('limits uploads per User', async () => {
    const { app } = await startServer({ rateLimits: { upload: tight } });
    const alice = await loginAs(app, await createUser('alice'));
    const upload = () =>
      request(app)
        .post('/api/upload')
        .set(alice)
        .attach('file', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' });

    await upload().expect(200);
    await upload().expect(200);
    expectRateLimited(await upload());
  });

  it('limits GET /api/users per User, without affecting other Users', async () => {
    const { app } = await startServer({ rateLimits: { userSearch: tight } });
    const alice = await loginAs(app, await createUser('alice'));
    const bob = await loginAs(app, await createUser('bob'));
    const search = (session: typeof alice) => request(app).get('/api/users?q=a').set(session);

    await search(alice).expect(200);
    await search(alice).expect(200);
    expectRateLimited(await search(alice));
    await search(bob).expect(200);
  });

  it('limits /api/gifs/* per User, trending and search combined', async () => {
    const { app } = await startServer({ rateLimits: { gifs: tight } });
    const alice = await loginAs(app, await createUser('alice'));

    await request(app).get('/api/gifs/trending').set(alice).expect(200);
    await request(app).get('/api/gifs/search?q=cat').set(alice).expect(200);
    expectRateLimited(await request(app).get('/api/gifs/trending').set(alice));
  });

  it('limits POST /api/rooms per User, but not reading rooms', async () => {
    const { app } = await startServer({ rateLimits: { roomCreate: tight } });
    const alice = await loginAs(app, await createUser('alice'));
    const createRoom = (name: string) => request(app).post('/api/rooms').set(alice).send({ name });

    await createRoom('one').expect(201);
    await createRoom('two').expect(201);
    expectRateLimited(await createRoom('three'));
    await request(app).get('/api/rooms').set(alice).expect(200);
  });
});

async function connect(server: TestServer, user: { id: string; username: string }): Promise<ClientSocketType> {
  const client = ClientSocket(`http://localhost:${server.port}`, {
    extraHeaders: await loginAs(server.app, user),
    transports: ['websocket'],
  });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emitWithAck<T = any>(socket: ClientSocketType, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

/** Records every payload of `event` the socket receives from now on. */
function record<T = any>(socket: ClientSocketType, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (data: T) => received.push(data));
  return received;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createDirectChat(a: { id: string }, b: { id: string }) {
  const [user1Id, user2Id] = normalizeDirectChatPair(a.id, b.id);
  return getPrisma().directChat.create({
    data: { user1Id, user2Id, participants: { create: [{ userId: a.id }, { userId: b.id }] } },
  });
}

async function createRoomWith(owner: { id: string }, member: { id: string }) {
  return getPrisma().room.create({
    data: {
      name: 'General',
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: RoomRole.OWNER },
          { userId: member.id, role: RoomRole.MEMBER },
        ],
      },
    },
  });
}

describe('Rate limiting: sending messages over the socket (SEC-07)', () => {
  it('A22: of 300 parallel direct:send, only the 10 within the limit are stored; the rest get RATE_LIMITED', async () => {
    const server = await startServer({}, true);
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    const chat = await createDirectChat(alice, bob);
    const attacker = await connect(server, alice);

    const acks = await Promise.all(
      Array.from({ length: 300 }, (_, i) =>
        emitWithAck(attacker, SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.id, content: `spam ${i}` })
      )
    );

    const accepted = acks.filter((ack) => ack.success === true);
    const limited = acks.filter((ack) => ack.success === false);
    expect(accepted).toHaveLength(10);
    expect(limited).toHaveLength(290);
    for (const ack of limited) {
      expect(ack).toMatchObject({ success: false, error: ERROR_CODES.RATE_LIMITED });
      expect(ack.retryAfterMs).toBeGreaterThan(0);
      expect(ack.retryAfterMs).toBeLessThanOrEqual(10_000);
    }

    const res = await request(server.app)
      .get(`/api/direct-chats/${chat.id}/messages?limit=100`)
      .set(await loginAs(server.app, bob))
      .expect(200);
    expect(res.body.messages).toHaveLength(10);
  });

  it('counts direct:send and room:send together, across all sockets of the User', async () => {
    const server = await startServer({ rateLimits: { messageSend: { max: 3, windowMs: 60_000 } } }, true);
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    const chat = await createDirectChat(alice, bob);
    const room = await createRoomWith(alice, bob);
    const firstTab = await connect(server, alice);
    const secondTab = await connect(server, alice);
    const send = (socket: ClientSocketType, event: string, payload: object) => emitWithAck(socket, event, payload);

    expect(await send(firstTab, SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.id, content: 'one' })).toMatchObject({ success: true });
    expect(await send(firstTab, SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'two' })).toMatchObject({ success: true });
    expect(await send(secondTab, SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'three' })).toMatchObject({ success: true });
    expect(await send(secondTab, SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.id, content: 'four' })).toMatchObject({
      success: false,
      error: ERROR_CODES.RATE_LIMITED,
    });
    expect(await send(firstTab, SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'five' })).toMatchObject({
      success: false,
      error: ERROR_CODES.RATE_LIMITED,
    });

    // Another User has their own budget.
    const bobSocket = await connect(server, bob);
    expect(await send(bobSocket, SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.id, content: 'hi' })).toMatchObject({ success: true });
  });

  it('lets the User send again once the bucket refills', async () => {
    const server = await startServer({ rateLimits: { messageSend: { max: 1, windowMs: 150 } } }, true);
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    const chat = await createDirectChat(alice, bob);
    const socket = await connect(server, alice);

    await emitWithAck(socket, SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.id, content: 'one' });
    const limited = await emitWithAck(socket, SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.id, content: 'two' });
    expect(limited).toMatchObject({ success: false, error: ERROR_CODES.RATE_LIMITED });

    await pause(limited.retryAfterMs + 20);
    expect(await emitWithAck(socket, SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.id, content: 'three' })).toMatchObject({
      success: true,
    });
  });
});

describe('Rate limiting: Typing Indicator (SEC-07)', () => {
  it('does not forward direct typing events over 1 per second, but still forwards the stop', async () => {
    const server = await startServer({}, true);
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    const chat = await createDirectChat(alice, bob);
    const aliceSocket = await connect(server, alice);
    const bobSocket = await connect(server, bob);
    const received = record(bobSocket, SOCKET_EVENTS.DIRECT_TYPING);

    for (let i = 0; i < 5; i++) {
      aliceSocket.emit(SOCKET_EVENTS.DIRECT_TYPING, { directChatId: chat.id, isTyping: true });
    }
    aliceSocket.emit(SOCKET_EVENTS.DIRECT_TYPING, { directChatId: chat.id, isTyping: false });
    aliceSocket.emit(SOCKET_EVENTS.DIRECT_TYPING, { directChatId: chat.id, isTyping: false });
    await pause(SILENCE_MS);

    expect(received.map((event) => event.isTyping)).toEqual([true, false]);
  });

  it('does not forward room typing events over the limit, counted together with direct typing', async () => {
    const server = await startServer({}, true);
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    const chat = await createDirectChat(alice, bob);
    const room = await createRoomWith(alice, bob);
    const aliceSocket = await connect(server, alice);
    const bobSocket = await connect(server, bob);
    // Rooms are joined in the background on connect; join explicitly so both are surely in the room.
    await emitWithAck(aliceSocket, SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
    await emitWithAck(bobSocket, SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
    const roomTyping = record(bobSocket, SOCKET_EVENTS.ROOM_TYPING);
    const directTyping = record(bobSocket, SOCKET_EVENTS.DIRECT_TYPING);

    aliceSocket.emit(SOCKET_EVENTS.ROOM_TYPING, { roomId: room.id, isTyping: true });
    aliceSocket.emit(SOCKET_EVENTS.ROOM_TYPING, { roomId: room.id, isTyping: true });
    aliceSocket.emit(SOCKET_EVENTS.DIRECT_TYPING, { directChatId: chat.id, isTyping: true });
    // A stop for a start that was never forwarded is dropped as well.
    aliceSocket.emit(SOCKET_EVENTS.DIRECT_TYPING, { directChatId: chat.id, isTyping: false });
    await pause(SILENCE_MS);

    expect(roomTyping.map((event) => event.isTyping)).toEqual([true]);
    expect(directTyping).toEqual([]);
  });
});
