import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestServer, loginAs, SessionHeaders, TEST_APP_ORIGIN } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { RoomRole, MessageType } from '@webchat/shared';

let app: Express;

beforeAll(async () => {
  ({ app } = await createTestServer());
});

describe('Room Chat REST APIs & Role Governance', () => {
  let ownerUser: any;
  let adminUser: any;
  let memberUser: any;
  let outsiderUser: any;

  let ownerSession: SessionHeaders;
  let adminSession: SessionHeaders;
  let memberSession: SessionHeaders;
  let outsiderSession: SessionHeaders;

  beforeEach(async () => {
    const prisma = getPrisma();

    ownerUser = await prisma.user.create({
      data: {
        username: 'alice_owner',
        email: 'alice@example.com',
        passwordHash: 'hash1',
      },
    });

    adminUser = await prisma.user.create({
      data: {
        username: 'bob_admin',
        email: 'bob@example.com',
        passwordHash: 'hash2',
      },
    });

    memberUser = await prisma.user.create({
      data: {
        username: 'charlie_member',
        email: 'charlie@example.com',
        passwordHash: 'hash3',
      },
    });

    outsiderUser = await prisma.user.create({
      data: {
        username: 'david_outsider',
        email: 'david@example.com',
        passwordHash: 'hash4',
      },
    });

    ownerSession = await loginAs(app, ownerUser);
    adminSession = await loginAs(app, adminUser);
    memberSession = await loginAs(app, memberUser);
    outsiderSession = await loginAs(app, outsiderUser);
  });

  describe('POST /api/rooms', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app)
        .post('/api/rooms')
        .set('Origin', TEST_APP_ORIGIN)
        .send({ name: 'General' })
        .expect(401);
    });

    it('returns 400 if room name is missing or empty', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set(ownerSession)
        .send({ name: '   ' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.fields).toEqual([{ field: 'name', message: expect.stringMatching(/name is required/i) }]);
    });

    it('creates room and automatically adds creator as OWNER in RoomMember', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set(ownerSession)
        .send({
          name: 'Engineers Lounge',
          description: 'Place to discuss code',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Engineers Lounge');
      expect(res.body.description).toBe('Place to discuss code');
      expect(res.body.ownerId).toBe(ownerUser.id);

      const prisma = getPrisma();
      const memberRecord = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: res.body.id,
            userId: ownerUser.id,
          },
        },
      });

      expect(memberRecord).not.toBeNull();
      expect(memberRecord?.role).toBe(RoomRole.OWNER);
    });
  });

  describe('GET /api/rooms', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app).get('/api/rooms').expect(401);
    });

    it('returns list of rooms current user is a member of with memberCount, role and lastMessage', async () => {
      const prisma = getPrisma();

      // Room 1: owner is Alice, Charlie is member
      const room1 = await prisma.room.create({
        data: {
          name: 'Room 1',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: memberUser.id, role: RoomRole.MEMBER },
            ],
          },
          messages: {
            create: {
              senderId: ownerUser.id,
              content: 'Welcome to Room 1!',
            },
          },
        },
      });

      // Room 2: owner is Bob, Alice is NOT member
      await prisma.room.create({
        data: {
          name: 'Room 2',
          ownerId: adminUser.id,
          members: {
            create: [{ userId: adminUser.id, role: RoomRole.OWNER }],
          },
        },
      });

      const res = await request(app)
        .get('/api/rooms')
        .set(ownerSession)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(room1.id);
      expect(res.body[0].name).toBe('Room 1');
      expect(res.body[0].memberCount).toBe(2);
      expect(res.body[0].role).toBe(RoomRole.OWNER);
      expect(res.body[0].lastMessage?.content).toBe('Welcome to Room 1!');
      expect(res.body[0].unreadCount).toBe(0);
    });

    it('calculates accurate unreadCount for rooms considering lastReadMessageId and excluding self messages', async () => {
      const prisma = getPrisma();

      // Create test room with Alice (Owner) and Charlie (Member)
      const room = await prisma.room.create({
        data: {
          name: 'Unread Test Room',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: memberUser.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });

      // Charlie sends msg 1
      const msg1 = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: memberUser.id,
          content: 'Charlie room msg 1',
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
      });

      // Alice sends msg 2 (own message)
      await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: ownerUser.id,
          content: 'Alice room msg 2',
          createdAt: new Date('2026-01-01T10:05:00Z'),
        },
      });

      // Charlie sends msg 3
      const msg3 = await prisma.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: memberUser.id,
          content: 'Charlie room msg 3',
          createdAt: new Date('2026-01-01T10:10:00Z'),
        },
      });

      // Before reading: Alice should see 2 unread messages from Charlie (excluding her own msg 2)
      const resBefore = await request(app)
        .get('/api/rooms')
        .set(ownerSession)
        .expect(200);

      const targetRoomBefore = resBefore.body.find((r: any) => r.id === room.id);
      expect(targetRoomBefore.unreadCount).toBe(2);

      // Alice reads up to msg 1
      await prisma.roomMember.update({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: ownerUser.id,
          },
        },
        data: {
          lastReadMessageId: msg1.id,
        },
      });

      const resAfter1 = await request(app)
        .get('/api/rooms')
        .set(ownerSession)
        .expect(200);

      const targetRoomAfter1 = resAfter1.body.find((r: any) => r.id === room.id);
      expect(targetRoomAfter1.unreadCount).toBe(1);

      // Alice reads up to msg 3
      await prisma.roomMember.update({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: ownerUser.id,
          },
        },
        data: {
          lastReadMessageId: msg3.id,
        },
      });

      const resAfter3 = await request(app)
        .get('/api/rooms')
        .set(ownerSession)
        .expect(200);

      const targetRoomAfter3 = resAfter3.body.find((r: any) => r.id === room.id);
      expect(targetRoomAfter3.unreadCount).toBe(0);
    });
  });

  describe('GET /api/rooms/:id', () => {
    let roomId: string;

    beforeEach(async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'Project Room',
          description: 'A place for projects',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: adminUser.id, role: RoomRole.ADMIN },
              { userId: memberUser.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });
      roomId = room.id;
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app).get(`/api/rooms/${roomId}`).expect(401);
    });

    it('returns 404 if room does not exist', async () => {
      await request(app)
        .get('/api/rooms/non-existent-room-id')
        .set(ownerSession)
        .expect(404);
    });

    it('returns 403 if requester is not a member of the room', async () => {
      await request(app)
        .get(`/api/rooms/${roomId}`)
        .set(outsiderSession)
        .expect(403);
    });

    it('returns room details and member roster with roles for room members', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set(memberSession)
        .expect(200);

      expect(res.body.id).toBe(roomId);
      expect(res.body.name).toBe('Project Room');
      expect(res.body.description).toBe('A place for projects');
      expect(res.body.memberCount).toBe(3);
      expect(res.body.role).toBe(RoomRole.MEMBER);
      expect(Array.isArray(res.body.members)).toBe(true);
      expect(res.body.members).toHaveLength(3);

      const roles = res.body.members.map((m: any) => ({
        username: m.user.username,
        role: m.role,
      }));

      expect(roles).toContainEqual({ username: 'alice_owner', role: RoomRole.OWNER });
      expect(roles).toContainEqual({ username: 'bob_admin', role: RoomRole.ADMIN });
      expect(roles).toContainEqual({ username: 'charlie_member', role: RoomRole.MEMBER });
    });
  });

  describe('POST /api/rooms/:id/members (Add Member)', () => {
    let roomId: string;

    beforeEach(async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'Auth Test Room',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: adminUser.id, role: RoomRole.ADMIN },
              { userId: memberUser.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });
      roomId = room.id;
    });

    it('returns 403 when regular MEMBER tries to add a user', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/members`)
        .set(memberSession)
        .send({ userId: outsiderUser.id })
        .expect(403);

      expect(res.body.message).toMatch(/only owner or admin/i);
    });

    it('returns 400 if target user is already a member', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/members`)
        .set(ownerSession)
        .send({ userId: memberUser.id })
        .expect(400);

      expect(res.body.message).toMatch(/already a member/i);
    });

    it('allows OWNER to add a new member', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/members`)
        .set(ownerSession)
        .send({ userId: outsiderUser.id })
        .expect(201);

      expect(res.body.userId).toBe(outsiderUser.id);
      expect(res.body.role).toBe(RoomRole.MEMBER);
      expect(res.body.user.username).toBe(outsiderUser.username);
    });

    it('allows ADMIN to add a new member', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/members`)
        .set(adminSession)
        .send({ userId: outsiderUser.id })
        .expect(201);

      expect(res.body.userId).toBe(outsiderUser.id);
      expect(res.body.role).toBe(RoomRole.MEMBER);
    });
  });

  describe('DELETE /api/rooms/:id/members/:userId (Remove Member)', () => {
    let roomId: string;

    beforeEach(async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'Remove Test Room',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: adminUser.id, role: RoomRole.ADMIN },
              { userId: memberUser.id, role: RoomRole.MEMBER },
              { userId: outsiderUser.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });
      roomId = room.id;
    });

    it('returns 403 when regular MEMBER tries to remove another member', async () => {
      await request(app)
        .delete(`/api/rooms/${roomId}/members/${outsiderUser.id}`)
        .set(memberSession)
        .expect(403);
    });

    it('returns 400 when attempting to remove the OWNER', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${roomId}/members/${ownerUser.id}`)
        .set(adminSession)
        .expect(400);

      expect(res.body.message).toMatch(/cannot remove room owner/i);
    });

    it('returns 403 when ADMIN tries to remove another ADMIN', async () => {
      const prisma = getPrisma();
      // Make outsider an ADMIN too
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId: outsiderUser.id } },
        data: { role: RoomRole.ADMIN },
      });

      const res = await request(app)
        .delete(`/api/rooms/${roomId}/members/${outsiderUser.id}`)
        .set(adminSession)
        .expect(403);

      expect(res.body.message).toMatch(/admins can only remove regular members/i);
    });

    it('allows ADMIN to remove a regular MEMBER', async () => {
      await request(app)
        .delete(`/api/rooms/${roomId}/members/${memberUser.id}`)
        .set(adminSession)
        .expect(200);

      const prisma = getPrisma();
      const found = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: memberUser.id } },
      });
      expect(found).toBeNull();
    });

    it('allows OWNER to remove an ADMIN', async () => {
      await request(app)
        .delete(`/api/rooms/${roomId}/members/${adminUser.id}`)
        .set(ownerSession)
        .expect(200);

      const prisma = getPrisma();
      const found = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: adminUser.id } },
      });
      expect(found).toBeNull();
    });
  });

  describe('PATCH /api/rooms/:id/members/:userId/role (Change Role)', () => {
    let roomId: string;

    beforeEach(async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'Role Test Room',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: adminUser.id, role: RoomRole.ADMIN },
              { userId: memberUser.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });
      roomId = room.id;
    });

    it('returns 403 when non-owner (ADMIN or MEMBER) attempts to change roles', async () => {
      await request(app)
        .patch(`/api/rooms/${roomId}/members/${memberUser.id}/role`)
        .set(adminSession)
        .send({ role: RoomRole.ADMIN })
        .expect(403);
    });

    it('returns 400 when trying to change the OWNER role', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${roomId}/members/${ownerUser.id}/role`)
        .set(ownerSession)
        .send({ role: RoomRole.ADMIN })
        .expect(400);

      expect(res.body.message).toMatch(/cannot change role of room owner/i);
    });

    it('allows OWNER to promote MEMBER to ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${roomId}/members/${memberUser.id}/role`)
        .set(ownerSession)
        .send({ role: RoomRole.ADMIN })
        .expect(200);

      expect(res.body.role).toBe(RoomRole.ADMIN);
      expect(res.body.userId).toBe(memberUser.id);
    });

    it('allows OWNER to demote ADMIN to MEMBER', async () => {
      const res = await request(app)
        .patch(`/api/rooms/${roomId}/members/${adminUser.id}/role`)
        .set(ownerSession)
        .send({ role: RoomRole.MEMBER })
        .expect(200);

      expect(res.body.role).toBe(RoomRole.MEMBER);
    });
  });

  describe('POST /api/rooms/:id/leave (Leave Room)', () => {
    let roomId: string;

    beforeEach(async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'Leave Test Room',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: adminUser.id, role: RoomRole.ADMIN },
              { userId: memberUser.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });
      roomId = room.id;
    });

    it('returns 400 when OWNER attempts to leave without transferring ownership', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomId}/leave`)
        .set(ownerSession)
        .expect(400);

      expect(res.body.message).toMatch(/owner cannot leave/i);
    });

    it('allows regular MEMBER to leave', async () => {
      await request(app)
        .post(`/api/rooms/${roomId}/leave`)
        .set(memberSession)
        .expect(200);

      const prisma = getPrisma();
      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: memberUser.id } },
      });
      expect(member).toBeNull();
    });

    it('allows ADMIN to leave', async () => {
      await request(app)
        .post(`/api/rooms/${roomId}/leave`)
        .set(adminSession)
        .expect(200);

      const prisma = getPrisma();
      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId: adminUser.id } },
      });
      expect(member).toBeNull();
    });
  });

  describe('DELETE /api/rooms/:id (Delete Room)', () => {
    let roomId: string;

    beforeEach(async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'Delete Test Room',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: adminUser.id, role: RoomRole.ADMIN },
            ],
          },
        },
      });
      roomId = room.id;
    });

    it('returns 403 when ADMIN or MEMBER tries to delete room', async () => {
      await request(app)
        .delete(`/api/rooms/${roomId}`)
        .set(adminSession)
        .expect(403);
    });

    it('allows OWNER to delete the room', async () => {
      await request(app)
        .delete(`/api/rooms/${roomId}`)
        .set(ownerSession)
        .expect(200);

      const prisma = getPrisma();
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      expect(room).toBeNull();
    });
  });

  describe('GET /api/rooms/:id/messages', () => {
    let roomId: string;

    beforeEach(async () => {
      const prisma = getPrisma();
      const room = await prisma.room.create({
        data: {
          name: 'Messages Test Room',
          ownerId: ownerUser.id,
          members: {
            create: [
              { userId: ownerUser.id, role: RoomRole.OWNER },
              { userId: memberUser.id, role: RoomRole.MEMBER },
            ],
          },
        },
      });
      roomId = room.id;

      // Seed 3 messages chronologically
      await prisma.roomMessage.create({
        data: {
          roomId,
          senderId: ownerUser.id,
          content: 'First room message',
          createdAt: new Date(Date.now() - 3000),
        },
      });
      await prisma.roomMessage.create({
        data: {
          roomId,
          senderId: memberUser.id,
          content: 'Second room message',
          createdAt: new Date(Date.now() - 2000),
        },
      });
      await prisma.roomMessage.create({
        data: {
          roomId,
          senderId: ownerUser.id,
          content: 'Third room message',
          createdAt: new Date(Date.now() - 1000),
        },
      });
    });

    it('returns 403 when non-member requests messages', async () => {
      await request(app)
        .get(`/api/rooms/${roomId}/messages`)
        .set(outsiderSession)
        .expect(403);
    });

    it('returns messages in chronological order for room members', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomId}/messages`)
        .set(memberSession)
        .expect(200);

      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages).toHaveLength(3);
      expect(res.body.messages[0].content).toBe('First room message');
      expect(res.body.messages[1].content).toBe('Second room message');
      expect(res.body.messages[2].content).toBe('Third room message');
      expect(res.body.messages[0].sender.username).toBe(ownerUser.username);
    });
  });
});
