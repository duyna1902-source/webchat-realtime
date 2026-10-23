import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { SOCKET_EVENTS } from '@webchat/shared';
import { createTestServer, loginAs, SessionHeaders, TestServer } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';

// Seam 1: every socket payload is parsed with its shared schema before it reaches Prisma.

function connect(port: number, session: SessionHeaders): Promise<ClientSocketType> {
  return new Promise((resolve, reject) => {
    const client = ClientSocket(`http://localhost:${port}`, { extraHeaders: session, transports: ['websocket'] });
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emitWithAck<T = any>(client: ClientSocketType, event: string, payload: unknown): Promise<T> {
  return client.timeout(3000).emitWithAck(event, payload) as Promise<T>;
}

const validationError = (field: string) => ({
  success: false,
  error: 'VALIDATION_ERROR',
  requestId: expect.any(String),
  fields: [{ field, message: expect.any(String) }],
});

describe('Socket payload validation (SEC-05)', () => {
  let server: TestServer;
  let client: ClientSocketType | null = null;
  let roomId: string;
  let directChatId: string;

  beforeAll(async () => {
    server = await createTestServer({ listen: true });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { username: 'sender', email: 'sender@test.com', passwordHash: 'hash' } });
    const partner = await prisma.user.create({ data: { username: 'partner', email: 'partner@test.com', passwordHash: 'hash' } });
    const room = await prisma.room.create({
      data: { name: 'general', ownerId: user.id, members: { create: { userId: user.id, role: 'OWNER' } } },
    });
    const [user1Id, user2Id] = [user.id, partner.id].sort();
    const chat = await prisma.directChat.create({
      data: { user1Id, user2Id, participants: { create: [{ userId: user1Id }, { userId: user2Id }] } },
    });
    roomId = room.id;
    directChatId = chat.id;
    client = await connect(server.port, await loginAs(server.app, user));
  });

  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  it('direct:send with an operator object as directChatId is refused', async () => {
    const ack = await emitWithAck(client!, SOCKET_EVENTS.DIRECT_SEND, { directChatId: { not: 'x' }, content: 'hi' });
    expect(ack).toEqual(validationError('directChatId'));
  });

  it('room:send with content of the wrong type is refused', async () => {
    const ack = await emitWithAck(client!, SOCKET_EVENTS.ROOM_SEND, { roomId, content: { a: 1 } });
    expect(ack).toEqual(validationError('content'));
  });

  it('A19: attachment metadata longer than its limit is refused', async () => {
    const ack = await emitWithAck(client!, SOCKET_EVENTS.DIRECT_SEND, {
      directChatId,
      content: 'file',
      attachmentUrl: 'https://example.com/a.pdf',
      attachmentName: 'n'.repeat(20_000),
    });
    expect(ack).toEqual(validationError('attachmentName'));
  });

  it('a made-up message type or a negative attachment size is refused', async () => {
    expect(await emitWithAck(client!, SOCKET_EVENTS.ROOM_SEND, { roomId, content: 'x', type: 'SCRIPT' })).toEqual(
      validationError('type')
    );
    expect(
      await emitWithAck(client!, SOCKET_EVENTS.ROOM_SEND, {
        roomId,
        content: 'x',
        attachmentUrl: 'https://example.com/a.pdf',
        attachmentSize: -1,
      })
    ).toEqual(validationError('attachmentSize'));
  });

  it('typing and read events with wrongly typed fields are refused', async () => {
    expect(await emitWithAck(client!, SOCKET_EVENTS.ROOM_TYPING, { roomId, isTyping: 'yes' })).toEqual(
      validationError('isTyping')
    );
    expect(await emitWithAck(client!, SOCKET_EVENTS.DIRECT_TYPING, { directChatId: 42, isTyping: true })).toEqual(
      validationError('directChatId')
    );
    expect(await emitWithAck(client!, SOCKET_EVENTS.DIRECT_READ, { directChatId, messageId: { gt: '' } })).toEqual(
      validationError('messageId')
    );
    expect(await emitWithAck(client!, SOCKET_EVENTS.ROOM_READ, { roomId: [roomId], messageId: 'm' })).toEqual(
      validationError('roomId')
    );
  });

  it('room:join and room:leave require a string roomId', async () => {
    expect(await emitWithAck(client!, SOCKET_EVENTS.ROOM_JOIN, { roomId: { in: [roomId] } })).toEqual(
      validationError('roomId')
    );
    expect(await emitWithAck(client!, SOCKET_EVENTS.ROOM_LEAVE, { roomId: 7 })).toEqual(validationError('roomId'));
  });

  it('a valid message is still delivered', async () => {
    const ack = await emitWithAck(client!, SOCKET_EVENTS.ROOM_SEND, { roomId, content: 'hello' });
    expect(ack).toMatchObject({ success: true, message: { content: 'hello', type: 'TEXT' } });
    expect(ack.message.sender).not.toHaveProperty('avatarUrl');
  });
});
