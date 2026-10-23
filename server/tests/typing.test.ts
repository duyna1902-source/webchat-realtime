import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createTestServer, loginAs, SessionHeaders } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, normalizeDirectChatPair, DirectTypingPayload } from '@webchat/shared';

function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Direct Chat Typing Indicator Socket Integration', () => {
  let httpServer: http.Server;
  let serverPort: number;
  let clientAlice: ClientSocketType;
  let clientBob: ClientSocketType;
  let clientCharlie: ClientSocketType;
  let userAlice: any;
  let userBob: any;
  let userCharlie: any;
  let directChat: any;

  beforeAll(async () => {
    ({ httpServer, port: serverPort } = await createTestServer({ listen: true }));
  });

  afterEach(() => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
    if (clientCharlie?.connected) clientCharlie.disconnect();
  });

  afterAll(async () => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
    if (clientCharlie?.connected) clientCharlie.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    const prisma = getPrisma();

    userAlice = await prisma.user.create({
      data: { username: 'alice', email: 'alice@test.com', passwordHash: 'hash' },
    });
    userBob = await prisma.user.create({
      data: { username: 'bob', email: 'bob@test.com', passwordHash: 'hash' },
    });
    userCharlie = await prisma.user.create({
      data: { username: 'charlie', email: 'charlie@test.com', passwordHash: 'hash' },
    });

    const [u1, u2] = normalizeDirectChatPair(userAlice.id, userBob.id);
    directChat = await prisma.directChat.create({
      data: {
        user1Id: u1,
        user2Id: u2,
        participants: {
          create: [{ userId: userAlice.id }, { userId: userBob.id }],
        },
      },
    });

    const sessionAlice = await loginAs(httpServer, userAlice);
    const sessionBob = await loginAs(httpServer, userBob);
    const sessionCharlie = await loginAs(httpServer, userCharlie);

    clientAlice = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionAlice,
      transports: ['websocket'],
    });
    clientBob = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionBob,
      transports: ['websocket'],
    });
    clientCharlie = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionCharlie,
      transports: ['websocket'],
    });

    await Promise.all([
      waitForEvent(clientAlice, 'connect'),
      waitForEvent(clientBob, 'connect'),
      waitForEvent(clientCharlie, 'connect'),
    ]);
  });

  it('forwards direct:typing from sender to direct chat recipient', async () => {
    const bobTypingPromise = waitForEvent<DirectTypingPayload>(clientBob, SOCKET_EVENTS.DIRECT_TYPING);

    clientAlice.emit(SOCKET_EVENTS.DIRECT_TYPING, {
      directChatId: directChat.id,
      isTyping: true,
    });

    const typingPayload = await bobTypingPromise;
    expect(typingPayload).toMatchObject({
      directChatId: directChat.id,
      userId: userAlice.id,
      isTyping: true,
    });

    // Test typing stopped
    const bobStoppedPromise = waitForEvent<DirectTypingPayload>(clientBob, SOCKET_EVENTS.DIRECT_TYPING);

    clientAlice.emit(SOCKET_EVENTS.DIRECT_TYPING, {
      directChatId: directChat.id,
      isTyping: false,
    });

    const stoppedPayload = await bobStoppedPromise;
    expect(stoppedPayload).toMatchObject({
      directChatId: directChat.id,
      userId: userAlice.id,
      isTyping: false,
    });
  });

  it('does not send direct:typing to non-participants or allow non-participants to emit typing', async () => {
    let charlieReceived = false;
    clientCharlie.on(SOCKET_EVENTS.DIRECT_TYPING, () => {
      charlieReceived = true;
    });

    clientAlice.emit(SOCKET_EVENTS.DIRECT_TYPING, {
      directChatId: directChat.id,
      isTyping: true,
    });

    await waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_TYPING);
    await new Promise((r) => setTimeout(r, 100));
    expect(charlieReceived).toBe(false);

    // Charlie tries to emit typing to Alice & Bob's chat
    let bobReceivedFromCharlie = false;
    clientBob.on(SOCKET_EVENTS.DIRECT_TYPING, (payload: DirectTypingPayload) => {
      if (payload.userId === userCharlie.id) {
        bobReceivedFromCharlie = true;
      }
    });

    clientCharlie.emit(SOCKET_EVENTS.DIRECT_TYPING, {
      directChatId: directChat.id,
      isTyping: true,
    });

    await new Promise((r) => setTimeout(r, 150));
    expect(bobReceivedFromCharlie).toBe(false);
  });
});
