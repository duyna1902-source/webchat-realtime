import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import http from 'http';
import type { Express } from 'express';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createTestServer, generateToken } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, normalizeDirectChatPair, MessageType, RoomRole } from '@webchat/shared';

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

describe('GIF Search API & EMOJI_GIF Real-Time Messaging Integration', () => {
  let app: Express;
  let httpServer: http.Server;
  let serverPort: number;
  let clientAlice: ClientSocketType;
  let clientBob: ClientSocketType;
  let userAlice: any;
  let userBob: any;
  let tokenAlice: string;
  let tokenBob: string;

  beforeAll(async () => {
    ({ app, httpServer, port: serverPort } = await createTestServer({ listen: true }));
  });

  afterEach(() => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
  });

  afterAll(async () => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    const prisma = getPrisma();
    userAlice = await prisma.user.create({
      data: {
        username: `alice_gif_${Date.now()}`,
        email: `alice_gif_${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
      },
    });

    userBob = await prisma.user.create({
      data: {
        username: `bob_gif_${Date.now()}`,
        email: `bob_gif_${Date.now()}@example.com`,
        passwordHash: 'hashed_password',
      },
    });

    tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    tokenBob = generateToken({ userId: userBob.id, username: userBob.username });
  });

  describe('GIF REST API Endpoints', () => {
    it('rejects GET /api/gifs/trending without authentication', async () => {
      const res = await request(app).get('/api/gifs/trending').expect(401);
      expect(res.body.message).toMatch(/authorization required/i);
    });

    it('returns trending GIFs with valid structure when authenticated', async () => {
      const res = await request(app)
        .get('/api/gifs/trending')
        .set('Authorization', `Bearer ${tokenAlice}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const firstGif = res.body[0];
      expect(firstGif).toHaveProperty('id');
      expect(firstGif).toHaveProperty('title');
      expect(firstGif).toHaveProperty('url');
      expect(firstGif).toHaveProperty('previewUrl');
      expect(firstGif).toHaveProperty('width');
      expect(firstGif).toHaveProperty('height');
      expect(typeof firstGif.url).toBe('string');
      expect(firstGif.url).toMatch(/\.gif/i);
    });

    it('rejects GET /api/gifs/search without authentication', async () => {
      const res = await request(app).get('/api/gifs/search?q=happy').expect(401);
      expect(res.body.message).toMatch(/authorization required/i);
    });

    it('searches GIFs by query keyword when authenticated', async () => {
      const res = await request(app)
        .get('/api/gifs/search?q=dance')
        .set('Authorization', `Bearer ${tokenAlice}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const matches = res.body.some(
        (g: any) =>
          g.title.toLowerCase().includes('dance') ||
          (g.tags && g.tags.some((t: string) => t.toLowerCase().includes('dance')))
      );
      expect(matches).toBe(true);
    });

    it('returns trending GIFs when search query is empty or whitespace', async () => {
      const res = await request(app)
        .get('/api/gifs/search?q=   ')
        .set('Authorization', `Bearer ${tokenAlice}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('Direct Chat EMOJI_GIF Real-Time Messaging', () => {
    it('delivers direct message of type EMOJI_GIF and persists to database', async () => {
      const prisma = getPrisma();
      const [u1, u2] = normalizeDirectChatPair(userAlice.id, userBob.id);
      const directChat = await prisma.directChat.create({
        data: {
          user1Id: u1,
          user2Id: u2,
          participants: {
            create: [{ userId: userAlice.id }, { userId: userBob.id }],
          },
        },
      });

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

      const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_RECEIVE);
      const gifUrl = 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif';

      clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
        directChatId: directChat.id,
        content: gifUrl,
        type: MessageType.EMOJI_GIF,
      });

      const received = await bobReceivePromise;
      expect(received).toMatchObject({
        directChatId: directChat.id,
        content: gifUrl,
        type: MessageType.EMOJI_GIF,
        senderId: userAlice.id,
        status: 'DELIVERED',
      });

      // Verify DB persistence
      const savedMsg = await prisma.directMessage.findUnique({
        where: { id: received.id },
      });
      expect(savedMsg).not.toBeNull();
      expect(savedMsg?.type).toBe(MessageType.EMOJI_GIF);
      expect(savedMsg?.content).toBe(gifUrl);
    });
  });

  describe('Room Chat EMOJI_GIF Real-Time Messaging', () => {
    it('delivers room message of type EMOJI_GIF to room members and persists to database', async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'GIF Lovers',
          ownerId: userAlice.id,
          members: {
            create: [
              { userId: userAlice.id, role: RoomRole.OWNER },
              { userId: userBob.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });

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

      // Both join the room
      clientAlice.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
      clientBob.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });
      await new Promise((r) => setTimeout(r, 100));

      const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.ROOM_RECEIVE);
      const gifUrl = 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif';

      clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: gifUrl,
        type: MessageType.EMOJI_GIF,
      });

      const received = await bobReceivePromise;
      expect(received).toMatchObject({
        roomId: room.id,
        content: gifUrl,
        type: MessageType.EMOJI_GIF,
        senderId: userAlice.id,
      });

      // Verify DB persistence
      const savedMsg = await prisma.roomMessage.findUnique({
        where: { id: received.id },
      });
      expect(savedMsg).not.toBeNull();
      expect(savedMsg?.type).toBe(MessageType.EMOJI_GIF);
      expect(savedMsg?.content).toBe(gifUrl);
    });
  });
});
