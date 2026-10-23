import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createTestServer, loginAs, SessionHeaders } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, RoomRole, MessageType, RoomTypingPayload, MESSAGE_LIMITS } from '@webchat/shared';

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

describe('Room Chat Socket.io Real-Time Integration', () => {
  let httpServer: http.Server;
  let serverPort: number;
  let clientOwner: ClientSocketType;
  let clientMember: ClientSocketType;
  let clientOutsider: ClientSocketType;
  let ownerUser: any;
  let memberUser: any;
  let outsiderUser: any;
  let testRoom: any;

  beforeAll(async () => {
    ({ httpServer, port: serverPort } = await createTestServer({ listen: true }));
  });

  afterEach(() => {
    if (clientOwner?.connected) clientOwner.disconnect();
    if (clientMember?.connected) clientMember.disconnect();
    if (clientOutsider?.connected) clientOutsider.disconnect();
  });

  afterAll(async () => {
    if (clientOwner?.connected) clientOwner.disconnect();
    if (clientMember?.connected) clientMember.disconnect();
    if (clientOutsider?.connected) clientOutsider.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    const prisma = getPrisma();

    // Create users
    ownerUser = await prisma.user.create({
      data: { username: 'alice_owner', email: 'alice@test.com', passwordHash: 'hash' },
    });
    memberUser = await prisma.user.create({
      data: { username: 'bob_member', email: 'bob@test.com', passwordHash: 'hash' },
    });
    outsiderUser = await prisma.user.create({
      data: { username: 'charlie_outsider', email: 'charlie@test.com', passwordHash: 'hash' },
    });

    // Create Room with Alice (Owner) and Bob (Member)
    testRoom = await prisma.room.create({
      data: {
        name: 'Developers Room',
        ownerId: ownerUser.id,
        members: {
          create: [
            { userId: ownerUser.id, role: RoomRole.OWNER },
            { userId: memberUser.id, role: RoomRole.MEMBER },
          ],
        },
      },
    });

    const sessionOwner = await loginAs(httpServer, ownerUser);
    const sessionMember = await loginAs(httpServer, memberUser);
    const sessionOutsider = await loginAs(httpServer, outsiderUser);

    clientOwner = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionOwner,
      transports: ['websocket'],
    });
    clientMember = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionMember,
      transports: ['websocket'],
    });
    clientOutsider = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionOutsider,
      transports: ['websocket'],
    });

    await Promise.all([
      waitForEvent(clientOwner, 'connect'),
      waitForEvent(clientMember, 'connect'),
      waitForEvent(clientOutsider, 'connect'),
    ]);
  });

  it('rejects room:join if user is not a room member', async () => {
    const joinRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      clientOutsider.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, (res: any) => {
        resolve(res);
      });
    });

    expect(joinRes.success).toBe(false);
    expect(joinRes.error).toBe('FORBIDDEN');
  });

  it('allows members to join room and broadcasts room messages to room members', async () => {
    // Both Alice and Bob join the room
    const ownerJoin = await new Promise<{ success: boolean }>((resolve) => {
      clientOwner.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, resolve);
    });
    expect(ownerJoin.success).toBe(true);

    const memberJoin = await new Promise<{ success: boolean }>((resolve) => {
      clientMember.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, resolve);
    });
    expect(memberJoin.success).toBe(true);

    // Setup listener for Bob
    const bobReceivePromise = waitForEvent(clientMember, SOCKET_EVENTS.ROOM_RECEIVE);

    // Alice sends a message
    clientOwner.emit(SOCKET_EVENTS.ROOM_SEND, {
      roomId: testRoom.id,
      content: 'Welcome team to the new room!',
    });

    const receivedMessage = await bobReceivePromise;
    expect(receivedMessage).toMatchObject({
      roomId: testRoom.id,
      content: 'Welcome team to the new room!',
      senderId: ownerUser.id,
    });
    expect(receivedMessage.sender.username).toBe(ownerUser.username);

    // Verify DB persistence
    const prisma = getPrisma();
    const dbMsg = await prisma.roomMessage.findUnique({
      where: { id: receivedMessage.id },
    });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg?.content).toBe('Welcome team to the new room!');
    expect(dbMsg?.roomId).toBe(testRoom.id);
  });

  it('rejects room:send if sender is not a member of the room', async () => {
    let bobReceived = false;
    clientMember.on(SOCKET_EVENTS.ROOM_RECEIVE, () => {
      bobReceived = true;
    });

    const sendRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      clientOutsider.emit(
        SOCKET_EVENTS.ROOM_SEND,
        {
          roomId: testRoom.id,
          content: 'I want to spam this room',
        },
        resolve
      );
    });

    expect(sendRes.success).toBe(false);
    expect(sendRes.error).toBe('FORBIDDEN');

    await new Promise((r) => setTimeout(r, 300));
    expect(bobReceived).toBe(false);
  });

  it('stops receiving messages after room:leave is called', async () => {
    // Bob joins the room
    await new Promise<{ success: boolean }>((resolve) => {
      clientMember.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, resolve);
    });

    // Bob leaves the room socket channel
    await new Promise<{ success: boolean }>((resolve) => {
      clientMember.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId: testRoom.id }, resolve);
    });

    let bobReceived = false;
    clientMember.on(SOCKET_EVENTS.ROOM_RECEIVE, () => {
      bobReceived = true;
    });

    // Alice sends a message
    clientOwner.emit(SOCKET_EVENTS.ROOM_SEND, {
      roomId: testRoom.id,
      content: 'Bob, are you still there?',
    });

    await new Promise((r) => setTimeout(r, 400));
    expect(bobReceived).toBe(false);
  });

  it('broadcasts room:typing from sender to other room members and validates room membership', async () => {
    // Both Alice and Bob join the room
    await new Promise<{ success: boolean }>((resolve) => {
      clientOwner.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, resolve);
    });
    await new Promise<{ success: boolean }>((resolve) => {
      clientMember.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, resolve);
    });

    const bobTypingPromise = waitForEvent<RoomTypingPayload>(clientMember, SOCKET_EVENTS.ROOM_TYPING);

    // Alice starts typing
    clientOwner.emit(SOCKET_EVENTS.ROOM_TYPING, {
      roomId: testRoom.id,
      isTyping: true,
    });

    const receivedTyping = await bobTypingPromise;
    expect(receivedTyping).toMatchObject({
      roomId: testRoom.id,
      userId: ownerUser.id,
      username: ownerUser.username,
      isTyping: true,
    });

    // Alice stops typing
    const bobStoppedPromise = waitForEvent<RoomTypingPayload>(clientMember, SOCKET_EVENTS.ROOM_TYPING);

    clientOwner.emit(SOCKET_EVENTS.ROOM_TYPING, {
      roomId: testRoom.id,
      isTyping: false,
    });

    const receivedStopped = await bobStoppedPromise;
    expect(receivedStopped).toMatchObject({
      roomId: testRoom.id,
      userId: ownerUser.id,
      username: ownerUser.username,
      isTyping: false,
    });

    // Non-member Charlie tries to emit room:typing -> should be rejected
    const outsiderRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      clientOutsider.emit(
        SOCKET_EVENTS.ROOM_TYPING,
        {
          roomId: testRoom.id,
          isTyping: true,
        },
        resolve
      );
    });

    expect(outsiderRes.success).toBe(false);
    expect(outsiderRes.error).toBe('FORBIDDEN');
  });

  it('automatically joins member socket to room channel on connect so they receive room messages without explicit room:join', async () => {
    // Both Alice (Owner) and Bob (Member) are connected. Neither emitted room:join.
    const bobReceivePromise = waitForEvent(clientMember, SOCKET_EVENTS.ROOM_RECEIVE);

    clientOwner.emit(SOCKET_EVENTS.ROOM_SEND, {
      roomId: testRoom.id,
      content: 'Background broadcast to team!',
    });

    const received = await bobReceivePromise;
    expect(received).toMatchObject({
      roomId: testRoom.id,
      content: 'Background broadcast to team!',
      senderId: ownerUser.id,
    });
  });

  it('broadcasts room:member_change with action: DELETE to room members when room is deleted', async () => {
    const bobDeletePromise = waitForEvent(clientMember, SOCKET_EVENTS.ROOM_MEMBER_CHANGE);

    // Alice deletes the room via REST API
    const sessionOwner = await loginAs(httpServer, ownerUser);
    const res = await fetch(`http://localhost:${serverPort}/api/rooms/${testRoom.id}`, {
      method: 'DELETE',
      headers: sessionOwner,
    });

    expect(res.status).toBe(200);

    const payload = await bobDeletePromise;
    expect(payload).toMatchObject({
      roomId: testRoom.id,
      action: 'DELETE',
    });
  });

  it('rejects room:send when MEMBER sends message exceeding MESSAGE_LIMITS.ROOM_MEMBER (2000 chars)', async () => {
    let ownerReceived = false;
    clientOwner.on(SOCKET_EVENTS.ROOM_RECEIVE, () => {
      ownerReceived = true;
    });

    const oversizedContent = 'm'.repeat(MESSAGE_LIMITS.ROOM_MEMBER + 1); // 2001 chars

    const sendRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      clientMember.emit(
        SOCKET_EVENTS.ROOM_SEND,
        {
          roomId: testRoom.id,
          content: oversizedContent,
        },
        resolve
      );
    });

    expect(sendRes.success).toBe(false);
    expect(sendRes.error).toBe('MESSAGE_TOO_LONG');

    // Ensure owner did not receive broadcast
    await new Promise((r) => setTimeout(r, 200));
    expect(ownerReceived).toBe(false);

    // Ensure database record was NOT created
    const prisma = getPrisma();
    const dbMsg = await prisma.roomMessage.findFirst({
      where: { roomId: testRoom.id, senderId: memberUser.id },
    });
    expect(dbMsg).toBeNull();
  });

  it('allows room:send when MEMBER sends message of exactly MESSAGE_LIMITS.ROOM_MEMBER (2000 chars)', async () => {
    const exactContent = 'm'.repeat(MESSAGE_LIMITS.ROOM_MEMBER);
    const ownerReceivePromise = waitForEvent(clientOwner, SOCKET_EVENTS.ROOM_RECEIVE);

    const sendRes = await new Promise<{ success: boolean; message?: any }>((resolve) => {
      clientMember.emit(
        SOCKET_EVENTS.ROOM_SEND,
        {
          roomId: testRoom.id,
          content: exactContent,
        },
        resolve
      );
    });

    expect(sendRes.success).toBe(true);
    const receivedMsg = await ownerReceivePromise;
    expect(receivedMsg.content).toBe(exactContent);

    const prisma = getPrisma();
    const dbMsg = await prisma.roomMessage.findUnique({
      where: { id: receivedMsg.id },
    });
    expect(dbMsg).not.toBeNull();
    expect(dbMsg?.content).toBe(exactContent);
  });

  it('allows room:send when OWNER or ADMIN sends message up to MESSAGE_LIMITS.ROOM_LEADER (4000 chars)', async () => {
    const prisma = getPrisma();
    // Create admin user and join room as ADMIN
    const adminUser = await prisma.user.create({
      data: { username: 'dan_admin', email: 'dan@test.com', passwordHash: 'hash' },
    });
    await prisma.roomMember.create({
      data: { roomId: testRoom.id, userId: adminUser.id, role: RoomRole.ADMIN },
    });
    const sessionAdmin = await loginAs(httpServer, adminUser);
    const clientAdmin = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionAdmin,
      transports: ['websocket'],
    });

    try {
      // 1. OWNER sends 4000 characters
      const ownerContent = 'o'.repeat(MESSAGE_LIMITS.ROOM_LEADER);
      const memberReceivePromise = waitForEvent(clientMember, SOCKET_EVENTS.ROOM_RECEIVE);

      const ownerSendRes = await new Promise<{ success: boolean; message?: any }>((resolve) => {
        clientOwner.emit(
          SOCKET_EVENTS.ROOM_SEND,
          {
            roomId: testRoom.id,
            content: ownerContent,
          },
          resolve
        );
      });

      expect(ownerSendRes.success).toBe(true);
      const ownerMsgReceived = await memberReceivePromise;
      expect(ownerMsgReceived.content).toBe(ownerContent);

      // 2. ADMIN sends 4000 characters
      const adminContent = 'a'.repeat(MESSAGE_LIMITS.ROOM_LEADER);
      const memberReceivePromise2 = waitForEvent(clientMember, SOCKET_EVENTS.ROOM_RECEIVE);

      const adminSendRes = await new Promise<{ success: boolean; message?: any }>((resolve) => {
        clientAdmin.emit(
          SOCKET_EVENTS.ROOM_SEND,
          {
            roomId: testRoom.id,
            content: adminContent,
          },
          resolve
        );
      });

      expect(adminSendRes.success).toBe(true);
      const adminMsgReceived = await memberReceivePromise2;
      expect(adminMsgReceived.content).toBe(adminContent);

      const dbAdminMsg = await prisma.roomMessage.findUnique({
        where: { id: adminMsgReceived.id },
      });
      expect(dbAdminMsg).not.toBeNull();
      expect(dbAdminMsg?.content).toBe(adminContent);
    } finally {
      if (clientAdmin.connected) clientAdmin.disconnect();
    }
  });

  it('rejects room:send when OWNER or ADMIN sends message exceeding MESSAGE_LIMITS.ROOM_LEADER (4000 chars)', async () => {
    const prisma = getPrisma();
    const adminUser = await prisma.user.create({
      data: { username: 'eve_admin', email: 'eve@test.com', passwordHash: 'hash' },
    });
    await prisma.roomMember.create({
      data: { roomId: testRoom.id, userId: adminUser.id, role: RoomRole.ADMIN },
    });
    const sessionAdmin = await loginAs(httpServer, adminUser);
    const clientAdmin = ClientSocket(`http://localhost:${serverPort}`, {
      extraHeaders: sessionAdmin,
      transports: ['websocket'],
    });

    try {
      // 1. OWNER sends 4001 characters
      const ownerOversized = 'o'.repeat(MESSAGE_LIMITS.ROOM_LEADER + 1);
      const ownerSendRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        clientOwner.emit(
          SOCKET_EVENTS.ROOM_SEND,
          {
            roomId: testRoom.id,
            content: ownerOversized,
          },
          resolve
        );
      });

      expect(ownerSendRes.success).toBe(false);
      expect(ownerSendRes.error).toBe('MESSAGE_TOO_LONG');

      // 2. ADMIN sends 4001 characters
      const adminOversized = 'a'.repeat(MESSAGE_LIMITS.ROOM_LEADER + 1);
      const adminSendRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        clientAdmin.emit(
          SOCKET_EVENTS.ROOM_SEND,
          {
            roomId: testRoom.id,
            content: adminOversized,
          },
          resolve
        );
      });

      expect(adminSendRes.success).toBe(false);
      expect(adminSendRes.error).toBe('MESSAGE_TOO_LONG');

      // Verify neither message was saved
      const ownerMsg = await prisma.roomMessage.findFirst({
        where: { roomId: testRoom.id, senderId: ownerUser.id, content: ownerOversized },
      });
      expect(ownerMsg).toBeNull();

      const adminMsg = await prisma.roomMessage.findFirst({
        where: { roomId: testRoom.id, senderId: adminUser.id, content: adminOversized },
      });
      expect(adminMsg).toBeNull();
    } finally {
      if (clientAdmin.connected) clientAdmin.disconnect();
    }
  });
});
