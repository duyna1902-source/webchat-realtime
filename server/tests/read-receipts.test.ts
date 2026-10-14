import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupSocketServer } from '../src/socket/index.js';
import { generateToken } from '../src/lib/jwt.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, normalizeDirectChatPair, MessageStatus, MessageType, RoomRole } from '@webchat/shared';

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

describe('Read Receipts Socket Integration (direct:read and room:read)', () => {
  let httpServer: http.Server;
  let serverPort: number;
  let clientAlice: ClientSocketType;
  let clientBob: ClientSocketType;
  let clientCharlie: ClientSocketType;
  let userAlice: any;
  let userBob: any;
  let userCharlie: any;
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

    // Create a Room with Alice as OWNER and Bob as MEMBER
    room = await prisma.room.create({
      data: {
        name: 'General Discussion',
        description: 'Open team room',
        ownerId: userAlice.id,
        members: {
          create: [
            { userId: userAlice.id, role: RoomRole.OWNER },
            { userId: userBob.id, role: RoomRole.MEMBER },
          ],
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

  describe('direct:read socket event', () => {
    it('updates lastReadMessageId, marks messages as READ, and emits direct:read to recipient', async () => {
      const prisma = getPrisma();

      // Alice sends 2 messages to Bob
      const msg1 = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: userAlice.id,
          content: 'Message 1 from Alice',
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          createdAt: new Date(Date.now() - 5000),
        },
      });

      const msg2 = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: userAlice.id,
          content: 'Message 2 from Alice',
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          createdAt: new Date(Date.now() - 2000),
        },
      });

      // A later message 3 that should NOT be marked as read
      const msg3 = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: userAlice.id,
          content: 'Message 3 from Alice (unread)',
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          createdAt: new Date(Date.now() + 5000),
        },
      });

      // Alice sets up listener for direct:read
      const aliceReadPromise = waitForEvent(clientAlice, SOCKET_EVENTS.DIRECT_READ);

      // Bob emits direct:read for msg2
      clientBob.emit(SOCKET_EVENTS.DIRECT_READ, {
        directChatId: directChat.id,
        messageId: msg2.id,
      });

      const receipt = await aliceReadPromise;
      expect(receipt).toMatchObject({
        directChatId: directChat.id,
        messageId: msg2.id,
      });
      // Should contain either userId or readByUserId matching Bob's ID
      expect(receipt.userId || receipt.readByUserId).toBe(userBob.id);

      // Verify DB: Bob's participant record has lastReadMessageId updated
      const bobParticipant = await prisma.directChatParticipant.findUnique({
        where: {
          directChatId_userId: {
            directChatId: directChat.id,
            userId: userBob.id,
          },
        },
      });
      expect(bobParticipant?.lastReadMessageId).toBe(msg2.id);

      // Verify DB: msg1 and msg2 have status READ
      const updatedMsg1 = await prisma.directMessage.findUnique({ where: { id: msg1.id } });
      const updatedMsg2 = await prisma.directMessage.findUnique({ where: { id: msg2.id } });
      const updatedMsg3 = await prisma.directMessage.findUnique({ where: { id: msg3.id } });

      expect(updatedMsg1?.status).toBe(MessageStatus.READ);
      expect(updatedMsg2?.status).toBe(MessageStatus.READ);
      expect(updatedMsg3?.status).toBe(MessageStatus.SENT);
    });

    it('rejects direct:read if caller is not a participant of the direct chat', async () => {
      const prisma = getPrisma();

      const msg = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: userAlice.id,
          content: 'Secret message',
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
        },
      });

      let aliceReceived = false;
      clientAlice.on(SOCKET_EVENTS.DIRECT_READ, () => {
        aliceReceived = true;
      });

      // Charlie (non-participant) tries to emit direct:read
      clientCharlie.emit(SOCKET_EVENTS.DIRECT_READ, {
        directChatId: directChat.id,
        messageId: msg.id,
      });

      await new Promise((r) => setTimeout(r, 400));
      expect(aliceReceived).toBe(false);

      const dbMsg = await prisma.directMessage.findUnique({ where: { id: msg.id } });
      expect(dbMsg?.status).toBe(MessageStatus.SENT);
    });
  });

  describe('room:read socket event', () => {
    it('updates caller RoomMember lastReadMessageId and broadcasts room:read to room members', async () => {
      const prisma = getPrisma();

      // Alice sends a room message
      const roomMsg = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: userAlice.id,
          content: 'Hello Room members!',
          type: MessageType.TEXT,
        },
      });

      // Alice joins room socket
      clientAlice.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
      // Bob joins room socket
      clientBob.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
      await new Promise((r) => setTimeout(r, 200));

      const aliceRoomReadPromise = waitForEvent(clientAlice, SOCKET_EVENTS.ROOM_READ);

      // Bob emits room:read
      clientBob.emit(SOCKET_EVENTS.ROOM_READ, {
        roomId: room.id,
        messageId: roomMsg.id,
      });

      const receipt = await aliceRoomReadPromise;
      expect(receipt).toMatchObject({
        roomId: room.id,
        messageId: roomMsg.id,
      });
      expect(receipt.userId || receipt.readByUserId).toBe(userBob.id);

      // Verify DB: Bob's RoomMember record has lastReadMessageId updated
      const bobMember = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: userBob.id,
          },
        },
      });
      expect(bobMember?.lastReadMessageId).toBe(roomMsg.id);
    });

    it('rejects room:read if caller is not a member of the room', async () => {
      const prisma = getPrisma();

      const roomMsg = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: userAlice.id,
          content: 'Members-only message',
          type: MessageType.TEXT,
        },
      });

      clientAlice.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
      await new Promise((r) => setTimeout(r, 200));

      let aliceReceived = false;
      clientAlice.on(SOCKET_EVENTS.ROOM_READ, () => {
        aliceReceived = true;
      });

      // Charlie (non-member) tries to emit room:read
      clientCharlie.emit(SOCKET_EVENTS.ROOM_READ, {
        roomId: room.id,
        messageId: roomMsg.id,
      });

      await new Promise((r) => setTimeout(r, 400));
      expect(aliceReceived).toBe(false);
    });
  });
});
