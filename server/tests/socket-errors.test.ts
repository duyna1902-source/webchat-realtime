import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { SOCKET_EVENTS } from '@webchat/shared';
import { createTestServer, loginAs, SessionHeaders, TestServer } from './helpers/server.js';
import { createLogSink, LogSink } from './helpers/log-sink.js';
import { getPrisma } from '../src/lib/prisma.js';

function connect(port: number, session: SessionHeaders): Promise<ClientSocketType> {
  return new Promise((resolve, reject) => {
    const client = ClientSocket(`http://localhost:${port}`, { extraHeaders: session, transports: ['websocket'] });
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emitWithAck<T = any>(client: ClientSocketType, event: string, ...args: unknown[]): Promise<T> {
  return client.timeout(3000).emitWithAck(event, ...args) as Promise<T>;
}

describe('Socket error layer (SEC-05, SEC-09)', () => {
  let sink: LogSink;
  let server: TestServer;
  let client: ClientSocketType | null = null;
  let userId: string;
  let session: SessionHeaders;

  beforeAll(async () => {
    sink = createLogSink();
    server = await createTestServer({ listen: true, logger: sink.logger });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    const user = await getPrisma().user.create({
      data: { username: 'sock_err', usernameNormalized: 'sock_err', email: 'sock_err@test.com', passwordHash: 'hash' },
    });
    userId = user.id;
    session = await loginAs(server.app, user);
    client = await connect(server.port, session);
  });

  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  it('an unexpected failure acks only { success: false, error: INTERNAL_ERROR, requestId } and logs the stack', async () => {
    // Passes validation, then fails in the database: PostgreSQL text cannot hold a NUL byte.
    const room = await getPrisma().room.create({
      data: { name: 'nul', ownerId: userId, members: { create: { userId, role: 'OWNER' } } },
    });
    const ack = await emitWithAck(client!, SOCKET_EVENTS.ROOM_SEND, { roomId: room.id, content: 'hi\u0000' });

    expect(ack).toEqual({ success: false, error: 'INTERNAL_ERROR', requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });

    const entry = sink.entries().find((e) => e.requestId === ack.requestId && e.level >= 50);
    expect(entry).toBeDefined();
    expect(entry!.userId).toBe(userId);
    expect(entry!.event).toBe(SOCKET_EVENTS.ROOM_SEND);
    expect(entry!.err.stack).toMatch(/at /);
  });

  it('an expected failure acks its error code and a requestId', async () => {
    const owner = await getPrisma().user.create({
      data: { username: 'room_owner', usernameNormalized: 'room_owner', email: 'room_owner@test.com', passwordHash: 'hash' },
    });
    const room = await getPrisma().room.create({ data: { name: 'private', ownerId: owner.id } });

    const ack = await emitWithAck(client!, SOCKET_EVENTS.ROOM_JOIN, { roomId: room.id });

    expect(ack).toEqual({ success: false, error: 'FORBIDDEN', requestId: expect.any(String) });
  });

  it('an event sent with only an ack callback gets VALIDATION_ERROR instead of crashing the handler', async () => {
    const ack = await emitWithAck(client!, SOCKET_EVENTS.ROOM_SEND);

    expect(ack).toEqual({
      success: false,
      error: 'VALIDATION_ERROR',
      requestId: expect.any(String),
      fields: [{ field: '', message: expect.any(String) }],
    });
  });

  it('a packet over 64KB closes the connection and the server keeps serving', async () => {
    const disconnected = new Promise<string>((resolve) => client!.once('disconnect', (reason) => resolve(reason)));
    client!.emit(SOCKET_EVENTS.DIRECT_TYPING, { directChatId: 'x'.repeat(65 * 1024), isTyping: true });

    await expect(disconnected).resolves.toBeTruthy();

    const health = await fetch(`http://localhost:${server.port}/health`);
    expect(health.status).toBe(200);
  });

  it('a packet under 64KB is accepted', async () => {
    const ack = await emitWithAck(client!, SOCKET_EVENTS.ROOM_JOIN, { roomId: 'x'.repeat(60 * 1024) });

    expect(ack.success).toBe(false);
    expect(client!.connected).toBe(true);
  });
});
