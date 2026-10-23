import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import {
  createTestServer,
  loginAs,
  sessionCookieOf,
  sessionHeaders,
  SessionHeaders,
  TEST_APP_ORIGIN,
  TestServer,
} from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { RoomRole, SOCKET_EVENTS } from '@webchat/shared';

// SEC-13: a User's email is visible to that User only. Everyone else gets the public profile
// `{ id, username, isOnline, lastSeenAt }`, and user search is bounded (A11).

const PUBLIC_USER_KEYS = ['id', 'isOnline', 'lastSeenAt', 'username'];

let server: TestServer;
let app: Express;

beforeAll(async () => {
  server = await createTestServer({ listen: true });
  app = server.app;
});

afterAll(async () => {
  await server.close();
});

function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function connect(session: SessionHeaders): Promise<ClientSocketType> {
  const socket = ClientSocket(`http://localhost:${server.port}`, { extraHeaders: session, transports: ['websocket'] });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function createUser(username: string, email: string) {
  return getPrisma().user.create({ data: { username, email, passwordHash: 'hash' } });
}

describe('GET /api/users (bounded search)', () => {
  let alice: any;
  let aliceSession: SessionHeaders;

  beforeEach(async () => {
    alice = await createUser('alice', 'alice@example.com');
    await createUser('bob', 'bob@example.com');
    await createUser('Bobby.K', 'robert@corp.test');
    await createUser('charlie', 'charlie@example.com');
    aliceSession = await loginAs(app, alice);
  });

  it('rejects a search without q, or with an empty q, with 400', async () => {
    await request(app).get('/api/users').set(aliceSession).expect(400);
    await request(app).get('/api/users?q=').set(aliceSession).expect(400);
    await request(app).get('/api/users?q=%20%20').set(aliceSession).expect(400);
    await request(app).get('/api/users?q=a&q=b').set(aliceSession).expect(400);
  });

  it('returns public profiles only, without email (A11)', async () => {
    const res = await request(app).get('/api/users?q=b').set(aliceSession).expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    for (const user of res.body) {
      expect(Object.keys(user).sort()).toEqual(PUBLIC_USER_KEYS);
    }
    expect(JSON.stringify(res.body)).not.toContain('@');
  });

  it('matches username case-insensitively and excludes the requester', async () => {
    const res = await request(app).get('/api/users?q=BOB').set(aliceSession).expect(200);
    expect(res.body.map((u: any) => u.username).sort()).toEqual(['Bobby.K', 'bob']);

    const self = await request(app).get('/api/users?q=alice').set(aliceSession).expect(200);
    expect(self.body).toEqual([]);
  });

  it('never matches on email', async () => {
    for (const q of ['example.com', 'robert', 'corp', '@']) {
      const res = await request(app)
        .get(`/api/users?q=${encodeURIComponent(q)}`)
        .set(aliceSession)
        .expect(200);
      expect(res.body).toEqual([]);
    }
  });

  it('returns at most 20 results', async () => {
    for (let i = 0; i < 25; i++) {
      await createUser(`member${String(i).padStart(2, '0')}`, `member${i}@example.com`);
    }

    const res = await request(app).get('/api/users?q=member').set(aliceSession).expect(200);
    expect(res.body).toHaveLength(20);
  });
});

describe('Own account (SelfUserDto)', () => {
  it('register, login and /api/auth/me return the email to its owner', async () => {
    const account = { username: 'dora', email: 'dora@example.com', password: 'password123' };

    const registered = await request(app).post('/api/auth/register').set('Origin', TEST_APP_ORIGIN).send(account).expect(201);
    expect(registered.body.user.email).toBe('dora@example.com');

    const loggedIn = await request(app)
      .post('/api/auth/login')
      .set('Origin', TEST_APP_ORIGIN)
      .send({ emailOrUsername: 'dora', password: account.password })
      .expect(200);
    expect(loggedIn.body.user.email).toBe('dora@example.com');

    const me = await request(app)
      .get('/api/auth/me')
      .set(sessionHeaders(sessionCookieOf(loggedIn)))
      .expect(200);
    expect(me.body.user.email).toBe('dora@example.com');
  });
});

describe('the email of other Users never leaves the server', () => {
  let alice: any;
  let bob: any;
  let aliceSession: SessionHeaders;
  let bobSession: SessionHeaders;
  const sockets: ClientSocketType[] = [];

  beforeEach(async () => {
    alice = await createUser('alice', 'alice@example.com');
    bob = await createUser('bob', 'bob@example.com');
    aliceSession = await loginAs(app, alice);
    bobSession = await loginAs(app, bob);
  });

  afterEach(() => {
    while (sockets.length) sockets.pop()!.disconnect();
  });

  async function createRoomWithBob() {
    return getPrisma().room.create({
      data: {
        name: 'Team',
        ownerId: alice.id,
        members: {
          create: [
            { userId: alice.id, role: RoomRole.OWNER },
            { userId: bob.id, role: RoomRole.MEMBER },
          ],
        },
      },
    });
  }

  it('room detail and member changes expose public profiles only', async () => {
    const room = await createRoomWithBob();
    const charlie = await createUser('charlie', 'charlie@example.com');

    const detail = await request(app).get(`/api/rooms/${room.id}`).set(aliceSession).expect(200);
    expect(detail.body.members).toHaveLength(2);
    for (const member of detail.body.members) {
      expect(Object.keys(member.user).sort()).toEqual(PUBLIC_USER_KEYS);
    }

    const added = await request(app)
      .post(`/api/rooms/${room.id}/members`)
      .set(aliceSession)
      .send({ userId: charlie.id })
      .expect(201);
    expect(Object.keys(added.body.user).sort()).toEqual(PUBLIC_USER_KEYS);

    const promoted = await request(app)
      .patch(`/api/rooms/${room.id}/members/${charlie.id}/role`)
      .set(aliceSession)
      .send({ role: RoomRole.ADMIN })
      .expect(200);
    expect(Object.keys(promoted.body.user).sort()).toEqual(PUBLIC_USER_KEYS);

    expect(JSON.stringify([detail.body, added.body, promoted.body])).not.toContain('@example.com');
  });

  it('direct chats expose the partner and message senders as public profiles', async () => {
    const created = await request(app)
      .post('/api/direct-chats')
      .set(aliceSession)
      .send({ targetUserId: bob.id })
      .expect(201);
    expect(Object.keys(created.body.partner).sort()).toEqual(PUBLIC_USER_KEYS);

    await getPrisma().directMessage.create({
      data: { directChatId: created.body.id, senderId: bob.id, content: 'hi alice' },
    });

    const list = await request(app).get('/api/direct-chats').set(aliceSession).expect(200);
    expect(Object.keys(list.body[0].partner).sort()).toEqual(PUBLIC_USER_KEYS);
    expect(Object.keys(list.body[0].lastMessage.sender).sort()).toEqual(PUBLIC_USER_KEYS);

    const history = await request(app)
      .get(`/api/direct-chats/${created.body.id}/messages`)
      .set(aliceSession)
      .expect(200);
    expect(Object.keys(history.body.messages[0].sender).sort()).toEqual(PUBLIC_USER_KEYS);

    expect(JSON.stringify([created.body, list.body, history.body])).not.toContain('@example.com');
  });

  it('broadcast direct messages carry the sender as a public profile', async () => {
    const chat = await request(app)
      .post('/api/direct-chats')
      .set(aliceSession)
      .send({ targetUserId: bob.id })
      .expect(201);

    const aliceSocket = await connect(aliceSession);
    const bobSocket = await connect(bobSession);
    sockets.push(aliceSocket, bobSocket);

    const received = waitForEvent(aliceSocket, SOCKET_EVENTS.DIRECT_RECEIVE);
    bobSocket.emit(SOCKET_EVENTS.DIRECT_SEND, { directChatId: chat.body.id, content: 'hello' });
    const payload = await received;

    expect(Object.keys(payload.sender).sort()).toEqual(PUBLIC_USER_KEYS);
    expect(payload.sender.username).toBe('bob');
    expect(JSON.stringify(payload)).not.toContain('@example.com');
  });

  it('broadcast room messages carry the sender as a public profile', async () => {
    const room = await createRoomWithBob();

    const aliceSocket = await connect(aliceSession);
    const bobSocket = await connect(bobSession);
    sockets.push(aliceSocket, bobSocket);

    const received = waitForEvent(aliceSocket, SOCKET_EVENTS.ROOM_RECEIVE);
    bobSocket.emit(SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'hello team' });
    const payload = await received;

    expect(Object.keys(payload.sender).sort()).toEqual(PUBLIC_USER_KEYS);
    expect(payload.sender.username).toBe('bob');
    expect(JSON.stringify(payload)).not.toContain('@example.com');

    const history = await request(app)
      .get(`/api/rooms/${room.id}/messages`)
      .set(aliceSession)
      .expect(200);
    expect(Object.keys(history.body.messages[0].sender).sort()).toEqual(PUBLIC_USER_KEYS);
  });
});
