import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupSocketServer, getIO } from '../src/socket/index.js';
import { getPrisma } from '../src/lib/prisma.js';
import { generateToken } from '../src/lib/jwt.js';
import { normalizeDirectChatPair, SOCKET_EVENTS } from '@webchat/shared';

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

describe('Catch-up Sync & Reconnection Integration Tests', () => {
  let user1: any;
  let user2: any;
  let user3: any;
  let token1: string;
  let token2: string;
  let token3: string;
  let directChat: any;
  let room: any;

  beforeEach(async () => {
    const prisma = getPrisma();

    user1 = await prisma.user.create({
      data: {
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: 'hash1',
      },
    });

    user2 = await prisma.user.create({
      data: {
        username: 'bob',
        email: 'bob@example.com',
        passwordHash: 'hash2',
      },
    });

    user3 = await prisma.user.create({
      data: {
        username: 'charlie',
        email: 'charlie@example.com',
        passwordHash: 'hash3',
      },
    });

    token1 = generateToken({ userId: user1.id, username: user1.username });
    token2 = generateToken({ userId: user2.id, username: user2.username });
    token3 = generateToken({ userId: user3.id, username: user3.username });

    const [u1, u2] = normalizeDirectChatPair(user1.id, user2.id);
    directChat = await prisma.directChat.create({
      data: {
        user1Id: u1,
        user2Id: u2,
        participants: {
          create: [{ userId: user1.id }, { userId: user2.id }],
        },
      },
    });

    room = await prisma.room.create({
      data: {
        name: 'General Room',
        ownerId: user1.id,
        members: {
          create: [
            { userId: user1.id, role: 'OWNER' },
            { userId: user2.id, role: 'MEMBER' },
          ],
        },
      },
    });
  });

  describe('Direct Chat REST Catch-up Sync (?after=:lastMessageId)', () => {
    it('returns all messages strictly newer than the after message in chronological order (createdAt ASC)', async () => {
      const prisma = getPrisma();

      const msg1 = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: user1.id,
          content: 'Direct message 1',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      });

      const msg2 = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: user2.id,
          content: 'Direct message 2',
          createdAt: new Date('2026-01-01T10:01:00.000Z'),
        },
      });

      const msg3 = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: user1.id,
          content: 'Direct message 3',
          createdAt: new Date('2026-01-01T10:02:00.000Z'),
        },
      });

      const msg4 = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: user2.id,
          content: 'Direct message 4',
          createdAt: new Date('2026-01-01T10:03:00.000Z'),
        },
      });

      // Bob syncs messages created after msg2
      const res = await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?after=${msg2.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].id).toBe(msg3.id);
      expect(res.body.messages[0].content).toBe('Direct message 3');
      expect(res.body.messages[1].id).toBe(msg4.id);
      expect(res.body.messages[1].content).toBe('Direct message 4');
      expect(res.body.hasMore).toBe(false);
    });

    it('returns empty array when after message is the latest message', async () => {
      const prisma = getPrisma();

      const msg = await prisma.directMessage.create({
        data: {
          directChatId: directChat.id,
          senderId: user1.id,
          content: 'Single message',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      });

      const res = await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?after=${msg.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.messages).toEqual([]);
      expect(res.body.hasMore).toBe(false);
    });

    it('returns empty array when after message ID does not exist', async () => {
      const res = await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?after=non-existent-id`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.messages).toEqual([]);
    });

    it('returns 403 when user is not a participant in direct chat', async () => {
      await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?after=some-id`)
        .set('Authorization', `Bearer ${token3}`)
        .expect(403);
    });
  });

  describe('Room Chat REST Catch-up Sync (?after=:lastMessageId)', () => {
    it('returns all room messages strictly newer than the after message in chronological order (createdAt ASC)', async () => {
      const prisma = getPrisma();

      const rmsg1 = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: user1.id,
          content: 'Room message 1',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      });

      const rmsg2 = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: user2.id,
          content: 'Room message 2',
          createdAt: new Date('2026-01-01T10:01:00.000Z'),
        },
      });

      const rmsg3 = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: user1.id,
          content: 'Room message 3',
          createdAt: new Date('2026-01-01T10:02:00.000Z'),
        },
      });

      const res = await request(app)
        .get(`/api/rooms/${room.id}/messages?after=${rmsg1.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].id).toBe(rmsg2.id);
      expect(res.body.messages[0].content).toBe('Room message 2');
      expect(res.body.messages[1].id).toBe(rmsg3.id);
      expect(res.body.messages[1].content).toBe('Room message 3');
      expect(res.body.hasMore).toBe(false);
    });

    it('returns empty array when after message is the latest room message', async () => {
      const prisma = getPrisma();

      const rmsg = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: user1.id,
          content: 'Latest room message',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      });

      const res = await request(app)
        .get(`/api/rooms/${room.id}/messages?after=${rmsg.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.messages).toEqual([]);
      expect(res.body.hasMore).toBe(false);
    });

    it('returns empty array when after message ID does not exist in room', async () => {
      const res = await request(app)
        .get(`/api/rooms/${room.id}/messages?after=non-existent-room-msg`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.messages).toEqual([]);
    });

    it('returns 403 when user is not a room member', async () => {
      await request(app)
        .get(`/api/rooms/${room.id}/messages?after=some-id`)
        .set('Authorization', `Bearer ${token3}`)
        .expect(403);
    });
  });

  describe('Multi-Client Simulation: Disconnection, Offline Sending & Catch-up Sync', () => {
    let httpServer: http.Server;
    let serverPort: number;
    let clientAlice: ClientSocketType | null = null;
    let clientBob: ClientSocketType | null = null;

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
    });

    afterAll(async () => {
      if (clientAlice?.connected) clientAlice.disconnect();
      if (clientBob?.connected) clientBob.disconnect();
      const io = getIO();
      if (io) {
        await new Promise<void>((resolve) => io.close(() => resolve()));
      }
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    });

    it('recovers missed direct and room messages after disconnection via catch-up sync without duplication', async () => {
      clientAlice = ClientSocket(`http://localhost:${serverPort}`, {
        auth: { token: token1 },
        transports: ['websocket'],
      });

      clientBob = ClientSocket(`http://localhost:${serverPort}`, {
        auth: { token: token2 },
        transports: ['websocket'],
      });

      await Promise.all([
        waitForEvent(clientAlice, 'connect'),
        waitForEvent(clientBob, 'connect'),
      ]);

      // Both join room
      clientAlice.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
      clientBob.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
      await new Promise((r) => setTimeout(r, 100));

      // 1. Initial message while both are connected
      const bobDirectPromise = waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_RECEIVE);
      clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
        directChatId: directChat.id,
        content: 'Hello Bob initial',
      });
      const initialDirectMsg = await bobDirectPromise;
      expect(initialDirectMsg.content).toBe('Hello Bob initial');

      const bobRoomPromise = waitForEvent(clientBob, SOCKET_EVENTS.ROOM_RECEIVE);
      clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: 'Hello Room initial',
      });
      const initialRoomMsg = await bobRoomPromise;
      expect(initialRoomMsg.content).toBe('Hello Room initial');

      // Local state for Bob before disconnect
      let bobDirectMessages = [initialDirectMsg];
      let bobRoomMessages = [initialRoomMsg];

      // 2. Bob disconnects (simulating network loss)
      clientBob.disconnect();
      await new Promise((r) => setTimeout(r, 100));

      // 3. Alice sends messages while Bob is offline
      const directOffline1 = waitForEvent(clientAlice, SOCKET_EVENTS.DIRECT_RECEIVE);
      clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
        directChatId: directChat.id,
        content: 'Missed direct 1',
      });
      await directOffline1;

      const directOffline2 = waitForEvent(clientAlice, SOCKET_EVENTS.DIRECT_RECEIVE);
      clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
        directChatId: directChat.id,
        content: 'Missed direct 2',
      });
      await directOffline2;

      const roomOffline1 = waitForEvent(clientAlice, SOCKET_EVENTS.ROOM_RECEIVE);
      clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: 'Missed room 1',
      });
      await roomOffline1;

      const roomOffline2 = waitForEvent(clientAlice, SOCKET_EVENTS.ROOM_RECEIVE);
      clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: 'Missed room 2',
      });
      await roomOffline2;

      // 4. Bob reconnects (simulating new socket / unrecovered session)
      clientBob = ClientSocket(`http://localhost:${serverPort}`, {
        auth: { token: token2 },
        transports: ['websocket'],
        forceNew: true,
      });
      await waitForEvent(clientBob, 'connect');

      // 5. Catch-up sync triggered using last known message IDs
      const lastDirectId = bobDirectMessages[bobDirectMessages.length - 1].id;
      const directSyncRes = await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?after=${lastDirectId}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(directSyncRes.body.messages).toHaveLength(2);
      expect(directSyncRes.body.messages[0].content).toBe('Missed direct 1');
      expect(directSyncRes.body.messages[1].content).toBe('Missed direct 2');

      // Bob's deduplication logic: append without duplicates
      const existingDirectIds = new Set(bobDirectMessages.map((m: any) => m.id));
      const newDirects = directSyncRes.body.messages.filter((m: any) => !existingDirectIds.has(m.id));
      bobDirectMessages = [...bobDirectMessages, ...newDirects];

      expect(bobDirectMessages).toHaveLength(3);
      expect(bobDirectMessages.map((m) => m.content)).toEqual([
        'Hello Bob initial',
        'Missed direct 1',
        'Missed direct 2',
      ]);

      // Catch-up sync for Room
      const lastRoomId = bobRoomMessages[bobRoomMessages.length - 1].id;
      const roomSyncRes = await request(app)
        .get(`/api/rooms/${room.id}/messages?after=${lastRoomId}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(roomSyncRes.body.messages).toHaveLength(2);
      expect(roomSyncRes.body.messages[0].content).toBe('Missed room 1');
      expect(roomSyncRes.body.messages[1].content).toBe('Missed room 2');

      const existingRoomIds = new Set(bobRoomMessages.map((m: any) => m.id));
      const newRooms = roomSyncRes.body.messages.filter((m: any) => !existingRoomIds.has(m.id));
      bobRoomMessages = [...bobRoomMessages, ...newRooms];

      expect(bobRoomMessages).toHaveLength(3);
      expect(bobRoomMessages.map((m) => m.content)).toEqual([
        'Hello Room initial',
        'Missed room 1',
        'Missed room 2',
      ]);

      // Cleanup
      clientAlice.disconnect();
      clientBob.disconnect();
    });
  });
});
