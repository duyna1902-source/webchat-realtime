import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupSocketServer } from '../src/socket/index.js';
import { generateToken } from '../src/lib/jwt.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, normalizeDirectChatPair } from '@webchat/shared';

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

describe('Direct Chat Socket.io Real-Time Integration', () => {
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
    httpServer = http.createServer(app);
    setupSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
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

    // Create users
    userAlice = await prisma.user.create({
      data: { username: 'alice', email: 'alice@test.com', passwordHash: 'hash' },
    });
    userBob = await prisma.user.create({
      data: { username: 'bob', email: 'bob@test.com', passwordHash: 'hash' },
    });
    userCharlie = await prisma.user.create({
      data: { username: 'charlie', email: 'charlie@test.com', passwordHash: 'hash' },
    });

    // Create DirectChat between Alice and Bob
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

    const tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    const tokenBob = generateToken({ userId: userBob.id, username: userBob.username });
    const tokenCharlie = generateToken({ userId: userCharlie.id, username: userCharlie.username });

    clientAlice = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });
    clientBob = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenBob },
      transports: ['websocket'],
    });
    clientCharlie = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenCharlie },
      transports: ['websocket'],
    });

    await Promise.all([
      waitForEvent(clientAlice, 'connect'),
      waitForEvent(clientBob, 'connect'),
      waitForEvent(clientCharlie, 'connect'),
    ]);
  });

  it('delivers direct:send from Alice to Bob via direct:receive and persists to DB', async () => {
    const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_RECEIVE);
    const aliceReceivePromise = waitForEvent(clientAlice, SOCKET_EVENTS.DIRECT_RECEIVE);

    clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
      directChatId: directChat.id,
      content: 'Hello Bob from Alice!',
      type: 'TEXT',
    });

    const [bobMsg, aliceMsg] = await Promise.all([bobReceivePromise, aliceReceivePromise]);

    expect(bobMsg).toMatchObject({
      directChatId: directChat.id,
      content: 'Hello Bob from Alice!',
      senderId: userAlice.id,
      status: 'SENT',
    });
    expect(bobMsg.sender.username).toBe('alice');

    expect(aliceMsg).toMatchObject({
      directChatId: directChat.id,
      content: 'Hello Bob from Alice!',
      senderId: userAlice.id,
      status: 'SENT',
    });

    // Verify DB persistence
    const prisma = getPrisma();
    const dbMsg = await prisma.directMessage.findUnique({
      where: { id: bobMsg.id },
    });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg?.content).toBe('Hello Bob from Alice!');
    expect(dbMsg?.directChatId).toBe(directChat.id);
    expect(dbMsg?.senderId).toBe(userAlice.id);
  });

  it('rejects direct:send if sender is not a participant in the chat', async () => {
    let bobReceived = false;
    clientBob.on(SOCKET_EVENTS.DIRECT_RECEIVE, () => {
      bobReceived = true;
    });

    // Charlie tries to send to Alice and Bob's chat
    clientCharlie.emit(SOCKET_EVENTS.DIRECT_SEND, {
      directChatId: directChat.id,
      content: 'I am eavesdropping!',
      type: 'TEXT',
    });

    // Wait a brief moment to ensure nothing is delivered
    await new Promise((r) => setTimeout(r, 500));

    expect(bobReceived).toBe(false);

    // Verify nothing saved in DB
    const prisma = getPrisma();
    const count = await prisma.directMessage.count({
      where: { content: 'I am eavesdropping!' },
    });
    expect(count).toBe(0);
  });
});
