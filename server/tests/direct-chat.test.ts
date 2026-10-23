import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestServer, loginAs, SessionHeaders, TEST_APP_ORIGIN } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';

let app: Express;

beforeAll(async () => {
  ({ app } = await createTestServer());
});

describe('Direct Chat REST APIs', () => {
  let user1: any;
  let user2: any;
  let user3: any;
  let session1: SessionHeaders;
  let session2: SessionHeaders;

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

    session1 = await loginAs(app, user1);
    session2 = await loginAs(app, user2);
  });

  describe('GET /api/users', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app).get('/api/users').expect(401);
    });

    it('returns list of users excluding requesting user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set(session1)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      const userIds = res.body.map((u: any) => u.id);
      expect(userIds).toContain(user2.id);
      expect(userIds).toContain(user3.id);
      expect(userIds).not.toContain(user1.id);
      // Ensure passwordHash is not exposed
      expect(res.body[0]).not.toHaveProperty('passwordHash');
    });

    it('filters users by search query parameter (?q= or ?search=)', async () => {
      const resQ = await request(app)
        .get('/api/users?q=bob')
        .set(session1)
        .expect(200);

      expect(resQ.body).toHaveLength(1);
      expect(resQ.body[0].username).toBe('bob');

      const resSearch = await request(app)
        .get('/api/users?search=charlie')
        .set(session1)
        .expect(200);

      expect(resSearch.body).toHaveLength(1);
      expect(resSearch.body[0].username).toBe('charlie');
    });
  });

  describe('POST /api/direct-chats', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app)
        .post('/api/direct-chats')
        .set('Origin', TEST_APP_ORIGIN)
        .send({ targetUserId: user2.id })
        .expect(401);
    });

    it('returns 400 if targetUserId is missing or equals current user', async () => {
      await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({})
        .expect(400);

      await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({ targetUserId: user1.id })
        .expect(400);
    });

    it('returns 404 if targetUserId does not exist', async () => {
      await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({ targetUserId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('creates a new DirectChat with participants and returns 201', async () => {
      const res = await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({ targetUserId: user2.id })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.partner).toBeDefined();
      expect(res.body.partner.id).toBe(user2.id);
      expect(res.body.partner.username).toBe('bob');

      // Check DB participants
      const prisma = getPrisma();
      const participants = await prisma.directChatParticipant.findMany({
        where: { directChatId: res.body.id },
      });
      expect(participants).toHaveLength(2);
      const participantUserIds = participants.map((p) => p.userId);
      expect(participantUserIds).toContain(user1.id);
      expect(participantUserIds).toContain(user2.id);
    });

    it('returns existing DirectChat with 200 if chat already exists for this pair', async () => {
      // Alice creates chat with Bob
      const res1 = await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({ targetUserId: user2.id })
        .expect(201);

      // Bob creates chat with Alice (opposite order)
      const res2 = await request(app)
        .post('/api/direct-chats')
        .set(session2)
        .send({ targetUserId: user1.id })
        .expect(200);

      expect(res2.body.id).toBe(res1.body.id);
      expect(res2.body.partner.id).toBe(user1.id);
    });
  });

  describe('GET /api/direct-chats', () => {
    it('returns empty array when user has no direct chats', async () => {
      const res = await request(app)
        .get('/api/direct-chats')
        .set(session1)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns user direct chats with partner info and last message', async () => {
      const prisma = getPrisma();

      // Create direct chat between Alice and Bob
      const resCreate = await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({ targetUserId: user2.id })
        .expect(201);

      const chatId = resCreate.body.id;

      // Add a message in the chat
      await prisma.directMessage.create({
        data: {
          directChatId: chatId,
          senderId: user2.id,
          content: 'Hello Alice!',
        },
      });

      const res = await request(app)
        .get('/api/direct-chats')
        .set(session1)
        .expect(200);

      expect(res.body).toHaveLength(1);
      const chatItem = res.body[0];
      expect(chatItem.id).toBe(chatId);
      expect(chatItem.partner.id).toBe(user2.id);
      expect(chatItem.lastMessage).toBeDefined();
      expect(chatItem.lastMessage.content).toBe('Hello Alice!');
      expect(chatItem.lastMessage.sender.id).toBe(user2.id);
      expect(chatItem.unreadCount).toBe(1);
    });

    it('calculates accurate unreadCount considering lastReadMessageId and only partner messages', async () => {
      const prisma = getPrisma();

      // Alice & Bob chat
      const resCreate = await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({ targetUserId: user2.id })
        .expect(201);

      const chatId = resCreate.body.id;

      // Bob sends msg1
      const msg1 = await prisma.directMessage.create({
        data: {
          directChatId: chatId,
          senderId: user2.id,
          content: 'Bob msg 1',
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
      });

      // Alice sends msg2
      await prisma.directMessage.create({
        data: {
          directChatId: chatId,
          senderId: user1.id,
          content: 'Alice reply',
          createdAt: new Date('2026-01-01T10:05:00Z'),
        },
      });

      // Bob sends msg3
      const msg3 = await prisma.directMessage.create({
        data: {
          directChatId: chatId,
          senderId: user2.id,
          content: 'Bob msg 3',
          createdAt: new Date('2026-01-01T10:10:00Z'),
        },
      });

      // Before reading: Alice has 2 unread messages from Bob (msg1 and msg3, not Alice's msg2)
      const resBeforeRead = await request(app)
        .get('/api/direct-chats')
        .set(session1)
        .expect(200);

      const chatAliceBefore = resBeforeRead.body.find((c: any) => c.id === chatId);
      expect(chatAliceBefore.unreadCount).toBe(2);

      // Alice reads up to msg1
      await prisma.directChatParticipant.update({
        where: {
          directChatId_userId: {
            directChatId: chatId,
            userId: user1.id,
          },
        },
        data: {
          lastReadMessageId: msg1.id,
        },
      });

      // After reading msg1: Alice has 1 unread message (msg3)
      const resAfterMsg1 = await request(app)
        .get('/api/direct-chats')
        .set(session1)
        .expect(200);

      const chatAliceAfter1 = resAfterMsg1.body.find((c: any) => c.id === chatId);
      expect(chatAliceAfter1.unreadCount).toBe(1);

      // Alice reads up to msg3
      await prisma.directChatParticipant.update({
        where: {
          directChatId_userId: {
            directChatId: chatId,
            userId: user1.id,
          },
        },
        data: {
          lastReadMessageId: msg3.id,
        },
      });

      // After reading msg3: Alice has 0 unread messages
      const resAfterMsg3 = await request(app)
        .get('/api/direct-chats')
        .set(session1)
        .expect(200);

      const chatAliceAfter3 = resAfterMsg3.body.find((c: any) => c.id === chatId);
      expect(chatAliceAfter3.unreadCount).toBe(0);
    });
  });

  describe('GET /api/direct-chats/:id/messages', () => {
    let chatId: string;
    let session3: SessionHeaders;

    beforeEach(async () => {
      session3 = await loginAs(app, user3);

      // Create chat between Alice and Bob
      const res = await request(app)
        .post('/api/direct-chats')
        .set(session1)
        .send({ targetUserId: user2.id })
        .expect(201);

      chatId = res.body.id;
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app)
        .get(`/api/direct-chats/${chatId}/messages`)
        .expect(401);
    });

    it('returns 404 when chat does not exist', async () => {
      await request(app)
        .get('/api/direct-chats/00000000-0000-0000-0000-000000000000/messages')
        .set(session1)
        .expect(404);
    });

    it('returns 403 when requesting user is not a participant', async () => {
      // Charlie tries to access Alice and Bob's chat
      await request(app)
        .get(`/api/direct-chats/${chatId}/messages`)
        .set(session3)
        .expect(403);
    });

    it('returns messages in chronological order (createdAt ASC)', async () => {
      const prisma = getPrisma();

      // Seed 3 messages with slight delay
      const msg1 = await prisma.directMessage.create({
        data: {
          directChatId: chatId,
          senderId: user1.id,
          content: 'Message 1',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      });

      const msg2 = await prisma.directMessage.create({
        data: {
          directChatId: chatId,
          senderId: user2.id,
          content: 'Message 2',
          createdAt: new Date('2026-01-01T10:01:00.000Z'),
        },
      });

      const msg3 = await prisma.directMessage.create({
        data: {
          directChatId: chatId,
          senderId: user1.id,
          content: 'Message 3',
          createdAt: new Date('2026-01-01T10:02:00.000Z'),
        },
      });

      const res = await request(app)
        .get(`/api/direct-chats/${chatId}/messages`)
        .set(session1)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body.messages).toHaveLength(3);
      expect(res.body.messages[0].content).toBe('Message 1');
      expect(res.body.messages[1].content).toBe('Message 2');
      expect(res.body.messages[2].content).toBe('Message 3');
      expect(res.body.hasMore).toBe(false);
    });

    it('respects limit parameter and returns latest messages chronologically', async () => {
      const prisma = getPrisma();

      for (let i = 1; i <= 10; i++) {
        await prisma.directMessage.create({
          data: {
            directChatId: chatId,
            senderId: i % 2 === 0 ? user2.id : user1.id,
            content: `Message ${i}`,
            createdAt: new Date(Date.now() + i * 1000),
          },
        });
      }

      // Query limit 5
      const res = await request(app)
        .get(`/api/direct-chats/${chatId}/messages?limit=5`)
        .set(session2)
        .expect(200);

      expect(res.body.messages).toHaveLength(5);
      // The 5 messages should be messages 6, 7, 8, 9, 10 in chronological order
      expect(res.body.messages[0].content).toBe('Message 6');
      expect(res.body.messages[4].content).toBe('Message 10');
      expect(res.body.hasMore).toBe(true);
      expect(res.body.nextCursor).toBeDefined();
    });
  });
});


