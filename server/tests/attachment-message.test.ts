import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createTestServer, loginAs, SessionHeaders, TestServer } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { SOCKET_EVENTS, MessageType, normalizeDirectChatPair, MESSAGE_LIMITS } from '@webchat/shared';

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

function emitWithAck<T = any>(client: ClientSocketType, event: string, payload: unknown): Promise<T> {
  return client.timeout(3000).emitWithAck(event, payload) as Promise<T>;
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('Attachment Messages Socket Integration (IMAGE & DOCUMENT)', () => {
  let server: TestServer<InMemoryStorageAdapter>;
  let clientAlice: ClientSocketType;
  let clientBob: ClientSocketType;
  let sessionAlice: SessionHeaders;
  let sessionBob: SessionHeaders;
  let directChat: any;
  let room: any;

  beforeAll(async () => {
    server = await createTestServer({ listen: true });
  });

  afterAll(async () => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
    await server.close();
  });

  /** Uploads a file and returns its Attachment id. */
  async function uploadAs(session: SessionHeaders, filename: string, data: Buffer): Promise<string> {
    const res = await request(server.app)
      .post('/api/upload')
      .set(session)
      .attach('file', data, { filename, contentType: 'application/octet-stream' })
      .expect(201);
    return res.body.attachment.id;
  }

  const uploadImage = (session: SessionHeaders, filename = 'screenshot.png') => uploadAs(session, filename, PNG_1X1);
  const uploadDocument = (session: SessionHeaders, filename = 'spec.pdf') =>
    uploadAs(session, filename, Buffer.from('%PDF-1.4 spec'));

  beforeEach(async () => {
    const prisma = getPrisma();

    // Create users
    const userAlice = await prisma.user.create({
      data: { username: 'alice_attach', usernameNormalized: 'alice_attach', email: 'alice_attach@test.com', passwordHash: 'hash' },
    });
    const userBob = await prisma.user.create({
      data: { username: 'bob_attach', usernameNormalized: 'bob_attach', email: 'bob_attach@test.com', passwordHash: 'hash' },
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

    sessionAlice = await loginAs(server.app, userAlice);
    sessionBob = await loginAs(server.app, userBob);

    clientAlice = ClientSocket(`http://localhost:${server.port}`, {
      extraHeaders: sessionAlice,
      transports: ['websocket'],
    });
    clientBob = ClientSocket(`http://localhost:${server.port}`, {
      extraHeaders: sessionBob,
      transports: ['websocket'],
    });

    await Promise.all([waitForEvent(clientAlice, 'connect'), waitForEvent(clientBob, 'connect')]);
  });

  afterEach(() => {
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
  });

  it('delivers a direct image attachment message with the server-owned metadata', async () => {
    const attachmentId = await uploadImage(sessionAlice);
    const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_RECEIVE);

    clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
      directChatId: directChat.id,
      content: 'Check out this screenshot!',
      attachmentId,
    });

    const received = await bobReceivePromise;
    expect(received).toMatchObject({
      directChatId: directChat.id,
      type: MessageType.IMAGE,
      content: 'Check out this screenshot!',
      attachment: { id: attachmentId, kind: 'IMAGE', mimeType: 'image/png', name: 'screenshot.png' },
    });
    expect(server.storage.read(received.attachment.url)).toBeDefined();
  });

  it('delivers a direct document attachment message', async () => {
    const attachmentId = await uploadDocument(sessionAlice);
    const bobReceivePromise = waitForEvent(clientBob, SOCKET_EVENTS.DIRECT_RECEIVE);

    clientAlice.emit(SOCKET_EVENTS.DIRECT_SEND, {
      directChatId: directChat.id,
      content: 'Here is the project specification',
      attachmentId,
    });

    const received = await bobReceivePromise;
    expect(received).toMatchObject({
      type: MessageType.DOCUMENT,
      attachment: { id: attachmentId, kind: 'DOCUMENT', mimeType: 'application/pdf', name: 'spec.pdf', size: 13 },
    });
  });

  it('broadcasts room image and document attachment messages', async () => {
    const imageId = await uploadImage(sessionAlice, 'architecture.png');
    const documentId = await uploadDocument(sessionAlice, 'guidelines.pdf');

    const imagePromise = waitForEvent(clientBob, SOCKET_EVENTS.ROOM_RECEIVE);
    clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'Room diagram attached', attachmentId: imageId });
    expect(await imagePromise).toMatchObject({
      roomId: room.id,
      type: MessageType.IMAGE,
      content: 'Room diagram attached',
      attachment: { id: imageId, name: 'architecture.png' },
    });

    const documentPromise = waitForEvent(clientBob, SOCKET_EVENTS.ROOM_RECEIVE);
    clientAlice.emit(SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'Room guidelines', attachmentId: documentId });
    expect(await documentPromise).toMatchObject({
      type: MessageType.DOCUMENT,
      attachment: { id: documentId, name: 'guidelines.pdf' },
    });
  });

  describe('Attachment Captions Character Limit & Counter Integration (Ticket 05)', () => {
    const tooLong = { success: false, error: 'MESSAGE_TOO_LONG', requestId: expect.any(String) };

    it('rejects a direct attachment message whose caption exceeds the DIRECT limit (4000)', async () => {
      let bobReceived = false;
      clientBob.once(SOCKET_EVENTS.DIRECT_RECEIVE, () => {
        bobReceived = true;
      });
      const attachmentId = await uploadImage(sessionAlice);

      const ack = await emitWithAck(clientAlice, SOCKET_EVENTS.DIRECT_SEND, {
        directChatId: directChat.id,
        content: 'A'.repeat(MESSAGE_LIMITS.DIRECT + 1),
        attachmentId,
      });

      expect(ack).toEqual(tooLong);
      await new Promise((r) => setTimeout(r, 100));
      expect(bobReceived).toBe(false);
    });

    it('rejects a room attachment message whose MEMBER caption exceeds ROOM_MEMBER (2000), and keeps the Attachment sendable', async () => {
      const attachmentId = await uploadDocument(sessionBob);

      const ack = await emitWithAck(clientBob, SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: 'B'.repeat(MESSAGE_LIMITS.ROOM_MEMBER + 1),
        attachmentId,
      });
      expect(ack).toEqual(tooLong);

      const retry = await emitWithAck(clientBob, SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'short', attachmentId });
      expect(retry.success).toBe(true);
    });

    it('rejects a room attachment message whose leader caption exceeds ROOM_LEADER (4000)', async () => {
      const attachmentId = await uploadDocument(sessionAlice);

      const ack = await emitWithAck(clientAlice, SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: 'L'.repeat(MESSAGE_LIMITS.ROOM_LEADER + 1),
        attachmentId,
      });

      expect(ack).toEqual(tooLong);
    });

    it('accepts captions at the limit (2000 for member, 4000 for leader)', async () => {
      const memberCaption = 'M'.repeat(MESSAGE_LIMITS.ROOM_MEMBER);
      const memberAck = await emitWithAck(clientBob, SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: memberCaption,
        attachmentId: await uploadDocument(sessionBob, 'member-exact.pdf'),
      });
      expect(memberAck.success).toBe(true);
      expect(memberAck.message).toMatchObject({ content: memberCaption, attachment: { name: 'member-exact.pdf' } });

      const leaderCaption = 'L'.repeat(MESSAGE_LIMITS.ROOM_LEADER);
      const leaderAck = await emitWithAck(clientAlice, SOCKET_EVENTS.ROOM_SEND, {
        roomId: room.id,
        content: leaderCaption,
        attachmentId: await uploadImage(sessionAlice, 'leader-exact.png'),
      });
      expect(leaderAck.success).toBe(true);
      expect(leaderAck.message).toMatchObject({ content: leaderCaption, attachment: { name: 'leader-exact.png' } });
    });
  });
});
