import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupSocketServer } from '../src/socket/index.js';
import { generateToken } from '../src/lib/jwt.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, MessageType, normalizeDirectChatPair } from '@webchat/shared';

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

describe('Attachment Messages Socket Integration (IMAGE & DOCUMENT)', () => {
  let httpServer: http.Server;
  let serverPort: number;
  let clientAlice: ClientSocketType;
  let clientBob: ClientSocketType;
  let userAlice: any;
  let userBob: any;
  let directChat: any;
  let room: any;

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

  afterAll(async () => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    const prisma = getPrisma();

    // Create users
    userAlice = await prisma.user.create({
      data: { username: 'alice_attach', email: 'alice_attach@test.com', passwordHash: 'hash' },
    });
    userBob = await prisma.user.create({
      data: { username: 'bob_attach', email: 'bob_attach@test.com', passwordHash: 'hash' },
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

    // Create Room with Alice (OWNER) and Bob (MEMBER)
    room = await prisma.room.create({
      data: {
        name: 'Attachments Room',
        ownerId: userAlice.id,
        members: {
          create: [
            { userId: userAlice.id, role: 'OWNER' },
            { userId: userBob.id, role: 'MEMBER' },
          ],
        },
      },
    });

    const tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    const tokenBob = generateToken({ userId: userBob.id, username: userBob.username });

    clientAlice = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });
    clientBob = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenBob },
      transports: ['websocket'],
    });

    await Promise.all([
      waitForEvent(clientAlice, 'connect'),
      waitForEvent(clientBob, 'connect'),
    ]);

    // Join room
    clientAlice.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
    clientBob.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });

    // Wait 100ms for rooms to join
    await new Promise((r) => setTimeout(r, 100));
  });

  afterEach(() => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
  });

  it('delivers direct image attachment message and persists metadata to DB', async () => {
    const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_RECEIVE);

    clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
      directChatId: directChat.id,
      content: 'Check out this screenshot!',
      type: MessageType.IMAGE,
      attachmentUrl: '/uploads/screenshot.png',
      attachmentName: 'screenshot.png',
      attachmentSize: 1024 * 500, // 500 KB
    });

    const received = await bobReceivePromise;

    expect(received).toMatchObject({
      directChatId: directChat.id,
      senderId: userAlice.id,
      type: MessageType.IMAGE,
      content: 'Check out this screenshot!',
      attachmentUrl: '/uploads/screenshot.png',
      attachmentName: 'screenshot.png',
      attachmentSize: 512000,
    });

    const prisma = getPrisma();
    const dbMsg = await prisma.directMessage.findUnique({
      where: { id: received.id },
    });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg?.type).toBe(MessageType.IMAGE);
    expect(dbMsg?.attachmentUrl).toBe('/uploads/screenshot.png');
    expect(dbMsg?.attachmentName).toBe('screenshot.png');
    expect(dbMsg?.attachmentSize).toBe(512000);
  });

  it('delivers direct document attachment message and persists metadata to DB', async () => {
    const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_RECEIVE);

    clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
      directChatId: directChat.id,
      content: 'Here is the project specification',
      type: MessageType.DOCUMENT,
      attachmentUrl: '/uploads/spec.pdf',
      attachmentName: 'spec.pdf',
      attachmentSize: 2048000,
    });

    const received = await bobReceivePromise;

    expect(received).toMatchObject({
      directChatId: directChat.id,
      senderId: userAlice.id,
      type: MessageType.DOCUMENT,
      attachmentUrl: '/uploads/spec.pdf',
      attachmentName: 'spec.pdf',
      attachmentSize: 2048000,
    });

    const prisma = getPrisma();
    const dbMsg = await prisma.directMessage.findUnique({
      where: { id: received.id },
    });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg?.type).toBe(MessageType.DOCUMENT);
    expect(dbMsg?.attachmentUrl).toBe('/uploads/spec.pdf');
    expect(dbMsg?.attachmentName).toBe('spec.pdf');
    expect(dbMsg?.attachmentSize).toBe(2048000);
  });

  it('broadcasts room image attachment message and persists to RoomMessage', async () => {
    const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.ROOM_RECEIVE);

    clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, {
      roomId: room.id,
      content: 'Room diagram attached',
      type: MessageType.IMAGE,
      attachmentUrl: '/uploads/architecture.jpg',
      attachmentName: 'architecture.jpg',
      attachmentSize: 1200000,
    });

    const received = await bobReceivePromise;

    expect(received).toMatchObject({
      roomId: room.id,
      senderId: userAlice.id,
      type: MessageType.IMAGE,
      content: 'Room diagram attached',
      attachmentUrl: '/uploads/architecture.jpg',
      attachmentName: 'architecture.jpg',
      attachmentSize: 1200000,
    });

    const prisma = getPrisma();
    const dbMsg = await prisma.roomMessage.findUnique({
      where: { id: received.id },
    });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg?.type).toBe(MessageType.IMAGE);
    expect(dbMsg?.attachmentUrl).toBe('/uploads/architecture.jpg');
    expect(dbMsg?.attachmentName).toBe('architecture.jpg');
    expect(dbMsg?.attachmentSize).toBe(1200000);
  });

  it('broadcasts room document attachment message and persists to RoomMessage', async () => {
    const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.ROOM_RECEIVE);

    clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, {
      roomId: room.id,
      content: 'Room guidelines document',
      type: MessageType.DOCUMENT,
      attachmentUrl: '/uploads/guidelines.docx',
      attachmentName: 'guidelines.docx',
      attachmentSize: 340000,
    });

    const received = await bobReceivePromise;

    expect(received).toMatchObject({
      roomId: room.id,
      senderId: userAlice.id,
      type: MessageType.DOCUMENT,
      content: 'Room guidelines document',
      attachmentUrl: '/uploads/guidelines.docx',
      attachmentName: 'guidelines.docx',
      attachmentSize: 340000,
    });

    const prisma = getPrisma();
    const dbMsg = await prisma.roomMessage.findUnique({
      where: { id: received.id },
    });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg?.type).toBe(MessageType.DOCUMENT);
    expect(dbMsg?.attachmentUrl).toBe('/uploads/guidelines.docx');
    expect(dbMsg?.attachmentName).toBe('guidelines.docx');
  });
});
