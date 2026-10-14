import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupSocketServer } from '../src/socket/index.js';
import { generateToken } from '../src/lib/jwt.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, RoomRole, MessageType, RoomTypingPayload } from '@webchat/shared';

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

    const tokenOwner = generateToken({ userId: ownerUser.id, username: ownerUser.username });
    const tokenMember = generateToken({ userId: memberUser.id, username: memberUser.username });
    const tokenOutsider = generateToken({ userId: outsiderUser.id, username: outsiderUser.username });

    clientOwner = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenOwner },
      transports: ['websocket'],
    });
    clientMember = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenMember },
      transports: ['websocket'],
    });
    clientOutsider = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenOutsider },
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
    expect(joinRes.error).toMatch(/not a member/i);
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
      type: MessageType.TEXT,
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
          type: MessageType.TEXT,
        },
        resolve
      );
    });

    expect(sendRes.success).toBe(false);
    expect(sendRes.error).toMatch(/not a member/i);

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
      type: MessageType.TEXT,
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
    expect(outsiderRes.error).toMatch(/not a member/i);
  });
});
