import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createTestServer, loginAs, SessionHeaders, TestServer } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, RoomRole, MessageType, RoomReceiveMessagePayload } from '@webchat/shared';

// SEC-06: realtime access to a Room must follow Room Membership in the DB,
// including after Connection State Recovery.

/** Time allowed for a broadcast that should NOT arrive, after a control receiver already got it. */
const SILENCE_MS = 200;

function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitForMessage(socket: ClientSocketType, content: string, timeout = 3000): Promise<RoomReceiveMessagePayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, onMessage);
      reject(new Error(`Timeout waiting for message: ${content}`));
    }, timeout);
    function onMessage(msg: RoomReceiveMessagePayload) {
      if (msg.content !== content) return;
      clearTimeout(timer);
      socket.off(SOCKET_EVENTS.ROOM_RECEIVE, onMessage);
      resolve(msg);
    }
    socket.on(SOCKET_EVENTS.ROOM_RECEIVE, onMessage);
  });
}

function emitWithAck<T = any>(socket: ClientSocketType, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

/** Records every payload of `event` the socket receives from now on. */
function record<T = any>(socket: ClientSocketType, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (data: T) => received.push(data));
  return received;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Realtime Room Membership (SEC-06)', () => {
  let server: TestServer;
  let app: Express;
  let io: SocketServer;
  let url: string;
  const clients: ClientSocketType[] = [];

  let alice: any;
  let bob: any;
  let carol: any;
  let roomId: string;

  beforeAll(async () => {
    server = await createTestServer({ listen: true });
    ({ app, io } = server);
    url = `http://localhost:${server.port}`;
  });

  afterEach(() => {
    for (const c of clients.splice(0)) c.disconnect();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    const prisma = getPrisma();
    alice = await prisma.user.create({ data: { username: 'alice', usernameNormalized: 'alice', email: 'alice@test.com', passwordHash: 'hash' } });
    bob = await prisma.user.create({ data: { username: 'bob', usernameNormalized: 'bob', email: 'bob@test.com', passwordHash: 'hash' } });
    carol = await prisma.user.create({ data: { username: 'carol', usernameNormalized: 'carol', email: 'carol@test.com', passwordHash: 'hash' } });
    const room = await prisma.room.create({
      data: {
        name: 'Team',
        ownerId: alice.id,
        members: {
          create: [
            { userId: alice.id, role: RoomRole.OWNER },
            { userId: bob.id, role: RoomRole.MEMBER },
            { userId: carol.id, role: RoomRole.MEMBER },
          ],
        },
      },
    });
    roomId = room.id;
  });

  /** Logs the user in again: a fresh Session, like a second tab. */
  function sessionFor(user: any): Promise<SessionHeaders> {
    return loginAs(app, user);
  }

  /** Connects a user and makes sure the socket is subscribed to the test room. */
  async function connectMember(user: any): Promise<ClientSocketType> {
    const client = ClientSocket(url, {
      extraHeaders: await sessionFor(user),
      transports: ['websocket'],
      // Tests drive reconnection by hand, so a kick can land while the user is offline.
      reconnection: false,
    });
    clients.push(client);
    await waitForEvent(client, 'connect');
    const joined = await emitWithAck(client, SOCKET_EVENTS.ROOM_JOIN, { roomId });
    expect(joined.success).toBe(true);
    return client;
  }

  async function sendRoomMessage(sender: ClientSocketType, content: string): Promise<void> {
    const res = await emitWithAck(sender, SOCKET_EVENTS.ROOM_SEND, { roomId, content });
    expect(res.success).toBe(true);
  }

  /** Simulates a network drop: the transport dies without a clean socket.io disconnect. */
  async function dropTransport(client: ClientSocketType): Promise<void> {
    const sid = client.id!;
    const disconnected = waitForEvent(client, 'disconnect');
    client.io.engine.close();
    await disconnected;
    // Wait until the server has noticed too, so the session is persisted for recovery.
    for (let i = 0; i < 100 && io.sockets.sockets.has(sid); i++) await pause(10);
    expect(io.sockets.sockets.has(sid)).toBe(false);
  }

  async function reconnect(client: ClientSocketType): Promise<void> {
    const connected = waitForEvent(client, 'connect');
    client.connect();
    await connected;
  }

  it('A21: a member who leaves the room stops receiving room messages', async () => {
    const aliceClient = await connectMember(alice);
    const carolClient = await connectMember(carol);

    const warmup = waitForMessage(carolClient, 'warmup');
    await sendRoomMessage(aliceClient, 'warmup');
    await warmup;

    const leaveRes = await request(app)
      .post(`/api/rooms/${roomId}/leave`)
      .set(await sessionFor(carol));
    expect(leaveRes.status).toBe(200);

    const carolReceived = record<RoomReceiveMessagePayload>(carolClient, SOCKET_EVENTS.ROOM_RECEIVE);
    const aliceEcho = waitForMessage(aliceClient, 'secret after carol left');
    await sendRoomMessage(aliceClient, 'secret after carol left');
    await aliceEcho;
    await pause(SILENCE_MS);

    expect(carolReceived.map((m) => m.content)).toEqual([]);
  });

  it('B2: a member kicked while briefly offline does not regain the room on a recovered reconnect', async () => {
    const aliceClient = await connectMember(alice);
    const carolClient = await connectMember(carol);

    const warmup = waitForMessage(carolClient, 'warmup');
    await sendRoomMessage(aliceClient, 'warmup');
    await warmup;

    await dropTransport(carolClient);

    const kickRes = await request(app)
      .delete(`/api/rooms/${roomId}/members/${carol.id}`)
      .set(await sessionFor(alice));
    expect(kickRes.status).toBe(200);

    await reconnect(carolClient);
    expect(carolClient.recovered).toBe(true);

    const carolReceived = record<RoomReceiveMessagePayload>(carolClient, SOCKET_EVENTS.ROOM_RECEIVE);
    const aliceEcho = waitForMessage(aliceClient, 'secret after carol was kicked');
    await sendRoomMessage(aliceClient, 'secret after carol was kicked');
    await aliceEcho;
    await pause(SILENCE_MS);

    expect(carolReceived.map((m) => m.content)).toEqual([]);
  });

  it('a member kicked while offline does not get the room messages sent during the outage replayed, but still gets the kick notice', async () => {
    const aliceClient = await connectMember(alice);
    const carolClient = await connectMember(carol);

    const warmup = waitForMessage(carolClient, 'warmup');
    await sendRoomMessage(aliceClient, 'warmup');
    await warmup;

    await dropTransport(carolClient);

    const kickRes = await request(app)
      .delete(`/api/rooms/${roomId}/members/${carol.id}`)
      .set(await sessionFor(alice));
    expect(kickRes.status).toBe(200);
    await sendRoomMessage(aliceClient, 'secret sent while carol was offline');

    const carolReceived = record<RoomReceiveMessagePayload>(carolClient, SOCKET_EVENTS.ROOM_RECEIVE);
    const carolMemberChanges = record(carolClient, SOCKET_EVENTS.ROOM_MEMBER_CHANGE);
    await reconnect(carolClient);
    expect(carolClient.recovered).toBe(true);
    await pause(SILENCE_MS);

    expect(carolReceived.map((m) => m.content)).toEqual([]);
    expect(carolMemberChanges).toContainEqual(
      expect.objectContaining({ roomId, action: 'KICK', userId: carol.id })
    );
  });

  it('a member who left no longer receives typing indicators or read receipts of the room', async () => {
    const aliceClient = await connectMember(alice);
    const bobClient = await connectMember(bob);
    const carolClient = await connectMember(carol);

    const warmup = waitForMessage(bobClient, 'read me');
    await sendRoomMessage(aliceClient, 'read me');
    const message = await warmup;

    const leaveRes = await request(app)
      .post(`/api/rooms/${roomId}/leave`)
      .set(await sessionFor(carol));
    expect(leaveRes.status).toBe(200);

    const carolTyping = record(carolClient, SOCKET_EVENTS.ROOM_TYPING);
    const carolReads = record(carolClient, SOCKET_EVENTS.ROOM_READ);

    const bobSeesTyping = waitForEvent(bobClient, SOCKET_EVENTS.ROOM_TYPING);
    const typingRes = await emitWithAck(aliceClient, SOCKET_EVENTS.ROOM_TYPING, { roomId, isTyping: true });
    expect(typingRes.success).toBe(true);
    await bobSeesTyping;

    const aliceSeesRead = waitForEvent(aliceClient, SOCKET_EVENTS.ROOM_READ);
    const readRes = await emitWithAck(bobClient, SOCKET_EVENTS.ROOM_READ, { roomId, messageId: message.id });
    expect(readRes.success).toBe(true);
    await aliceSeesRead;

    await pause(SILENCE_MS);
    expect(carolTyping).toEqual([]);
    expect(carolReads).toEqual([]);
  });

  it('a valid member whose connection is recovered keeps receiving room messages, including those missed offline', async () => {
    const aliceClient = await connectMember(alice);
    const bobClient = await connectMember(bob);

    const warmup = waitForMessage(bobClient, 'warmup');
    await sendRoomMessage(aliceClient, 'warmup');
    await warmup;

    await dropTransport(bobClient);
    await sendRoomMessage(aliceClient, 'sent while bob was offline');

    const missed = waitForMessage(bobClient, 'sent while bob was offline');
    await reconnect(bobClient);
    expect(bobClient.recovered).toBe(true);
    await missed;

    const after = waitForMessage(bobClient, 'sent after bob reconnected');
    await sendRoomMessage(aliceClient, 'sent after bob reconnected');
    await expect(after).resolves.toMatchObject({ roomId, senderId: alice.id });
  });
});
