import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getPrisma } from '../src/lib/prisma.js';
import { generateToken } from '../src/lib/jwt.js';
import { normalizeDirectChatPair, MessageType, RoomRole, PaginatedMessagesDto, DirectReceiveMessagePayload, RoomReceiveMessagePayload } from '@webchat/shared';

describe('Cursor-Based Pagination Integration (Direct & Room Chats)', () => {
  let userAlice: any;
  let userBob: any;
  let userCharlie: any;
  let tokenAlice: string;
  let tokenCharlie: string;
  let directChat: any;
  let room: any;

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

    tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    tokenCharlie = generateToken({ userId: userCharlie.id, username: userCharlie.username });

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

    room = await prisma.room.create({
      data: {
        name: 'Project Room',
        ownerId: userAlice.id,
        members: {
          create: [
            { userId: userAlice.id, role: RoomRole.OWNER },
            { userId: userBob.id, role: RoomRole.MEMBER },
          ],
        },
      },
    });
  });

  describe('GET /api/direct-chats/:id/messages with cursor pagination', () => {
    it('returns latest 50 messages, then returns older 25 messages when ?before= is passed', async () => {
      const prisma = getPrisma();
      const baseTime = Date.now() - 100000;

      // Seed 75 direct messages in chronological order
      const messagesData = [];
      for (let i = 1; i <= 75; i++) {
        messagesData.push({
          directChatId: directChat.id,
          senderId: i % 2 === 0 ? userBob.id : userAlice.id,
          content: `Direct message #${i}`,
          type: MessageType.TEXT,
          createdAt: new Date(baseTime + i * 1000),
        });
      }

      await prisma.directMessage.createMany({
        data: messagesData,
      });

      // 1. Initial fetch without cursor: defaults to limit=50
      const res1 = await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?limit=50`)
        .set('Authorization', `Bearer ${tokenAlice}`)
        .expect(200);

      const batch1: PaginatedMessagesDto<DirectReceiveMessagePayload> = res1.body;
      expect(batch1.messages).toHaveLength(50);
      expect(batch1.hasMore).toBe(true);

      // Verify chronological order (createdAt ASC)
      expect(batch1.messages[0].content).toBe('Direct message #26');
      expect(batch1.messages[49].content).toBe('Direct message #75');
      for (let j = 0; j < batch1.messages.length - 1; j++) {
        expect(new Date(batch1.messages[j].createdAt).getTime()).toBeLessThan(
          new Date(batch1.messages[j + 1].createdAt).getTime()
        );
      }

      // Oldest message in first batch is M26
      const oldestInBatch1 = batch1.messages[0];
      expect(batch1.nextCursor).toBe(oldestInBatch1.id);

      // 2. Fetch older messages with ?before=<oldestId>
      const res2 = await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?limit=50&before=${oldestInBatch1.id}`)
        .set('Authorization', `Bearer ${tokenAlice}`)
        .expect(200);

      const batch2: PaginatedMessagesDto<DirectReceiveMessagePayload> = res2.body;
      expect(batch2.messages).toHaveLength(25);
      expect(batch2.hasMore).toBe(false);

      // Verify chronological order (M1 to M25)
      expect(batch2.messages[0].content).toBe('Direct message #1');
      expect(batch2.messages[24].content).toBe('Direct message #25');
      for (let j = 0; j < batch2.messages.length - 1; j++) {
        expect(new Date(batch2.messages[j].createdAt).getTime()).toBeLessThan(
          new Date(batch2.messages[j + 1].createdAt).getTime()
        );
      }
    });

    it('rejects access for non-participants', async () => {
      await request(app)
        .get(`/api/direct-chats/${directChat.id}/messages?limit=50`)
        .set('Authorization', `Bearer ${tokenCharlie}`)
        .expect(403);
    });
  });

  describe('GET /api/rooms/:id/messages with cursor pagination', () => {
    it('returns latest 50 messages, then returns older messages when ?before= is passed', async () => {
      const prisma = getPrisma();
      const baseTime = Date.now() - 100000;

      // Seed 60 room messages
      const messagesData = [];
      for (let i = 1; i <= 60; i++) {
        messagesData.push({
          roomId: room.id,
          senderId: i % 2 === 0 ? userBob.id : userAlice.id,
          content: `Room message #${i}`,
          type: MessageType.TEXT,
          createdAt: new Date(baseTime + i * 1000),
        });
      }

      await prisma.roomMessage.createMany({
        data: messagesData,
      });

      // 1. Initial fetch (limit 50)
      const res1 = await request(app)
        .get(`/api/rooms/${room.id}/messages?limit=50`)
        .set('Authorization', `Bearer ${tokenAlice}`)
        .expect(200);

      const batch1: PaginatedMessagesDto<RoomReceiveMessagePayload> = res1.body;
      expect(batch1.messages).toHaveLength(50);
      expect(batch1.hasMore).toBe(true);

      // Chronological order: RM11 to RM60
      expect(batch1.messages[0].content).toBe('Room message #11');
      expect(batch1.messages[49].content).toBe('Room message #60');

      const oldestInBatch1 = batch1.messages[0];
      expect(batch1.nextCursor).toBe(oldestInBatch1.id);

      // 2. Fetch older messages with ?before=
      const res2 = await request(app)
        .get(`/api/rooms/${room.id}/messages?limit=50&before=${oldestInBatch1.id}`)
        .set('Authorization', `Bearer ${tokenAlice}`)
        .expect(200);

      const batch2: PaginatedMessagesDto<RoomReceiveMessagePayload> = res2.body;
      expect(batch2.messages).toHaveLength(10);
      expect(batch2.hasMore).toBe(false);

      expect(batch2.messages[0].content).toBe('Room message #1');
      expect(batch2.messages[9].content).toBe('Room message #10');
    });

    it('rejects access for non-members', async () => {
      await request(app)
        .get(`/api/rooms/${room.id}/messages?limit=50`)
        .set('Authorization', `Bearer ${tokenCharlie}`)
        .expect(403);
    });
  });
});
