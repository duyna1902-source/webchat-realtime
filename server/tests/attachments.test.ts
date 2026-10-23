import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { SOCKET_EVENTS, MessageType, normalizeDirectChatPair } from '@webchat/shared';
import { createTestServer, loginAs, SessionHeaders, TestServer } from './helpers/server.js';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { getPrisma } from '../src/lib/prisma.js';

// Seam 1: Attachment records and signed URLs (SEC-03, SEC-14, SEC-15; ADR 0009).

const TTL_SECONDS = 60;

/** Clock shared by the in-memory storage, so a test can move past a signed URL's expiry. */
let now = Date.UTC(2026, 9, 23, 12, 0, 0);
let server: TestServer<InMemoryStorageAdapter>;

beforeAll(async () => {
  server = await createTestServer({
    listen: true,
    storage: new InMemoryStorageAdapter({ now: () => now }),
    config: { timing: { signedUrlTtlSeconds: TTL_SECONDS } },
  });
});

afterAll(async () => {
  await server.close();
});

interface TestUser {
  id: string;
  username: string;
  session: SessionHeaders;
}

async function createUser(username: string): Promise<TestUser> {
  const user = await getPrisma().user.create({
    data: { username, email: `${username}@test.com`, passwordHash: 'hash' },
  });
  return { id: user.id, username, session: await loginAs(server.app, user) };
}

function upload(user: TestUser, data: Buffer = Buffer.from('%PDF-1.4 quarterly report'), filename = 'report.pdf') {
  return request(server.app)
    .post('/api/upload')
    .set(user.session)
    .attach('file', data, { filename, contentType: 'application/octet-stream' });
}

describe('Upload creates an Attachment record', () => {
  let alice: TestUser;

  beforeEach(async () => {
    alice = await createUser('alice');
  });

  it('answers 201 { attachment } with a signed URL the uploader can preview', async () => {
    const res = await upload(alice).expect(201);

    expect(res.body).toEqual({
      attachment: {
        id: expect.any(String),
        kind: 'DOCUMENT',
        mimeType: 'application/pdf',
        size: 25,
        name: 'report.pdf',
        url: expect.any(String),
        urlExpiresAt: new Date(now + TTL_SECONDS * 1000).toISOString(),
      },
    });
    expect(server.storage.read(res.body.attachment.url)?.toString()).toBe('%PDF-1.4 quarterly report');
  });
});

function connect(user: TestUser): Promise<ClientSocketType> {
  return new Promise((resolve, reject) => {
    const client = ClientSocket(`http://localhost:${server.port}`, { extraHeaders: user.session, transports: ['websocket'] });
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

function emitWithAck<T = any>(client: ClientSocketType, event: string, payload: unknown): Promise<T> {
  return client.timeout(3000).emitWithAck(event, payload) as Promise<T>;
}

function waitForEvent<T = any>(client: ClientSocketType, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    client.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

const errorAck = (error: string) => ({ success: false, error, requestId: expect.any(String) });

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('Sending a message with an Attachment', () => {
  let alice: TestUser;
  let bob: TestUser;
  let mallory: TestUser;
  let directChatId: string;
  let roomId: string;
  let aliceClient: ClientSocketType;
  let bobClient: ClientSocketType;

  beforeEach(async () => {
    alice = await createUser('alice');
    bob = await createUser('bob');
    mallory = await createUser('mallory');
    const prisma = getPrisma();
    const [user1Id, user2Id] = normalizeDirectChatPair(alice.id, bob.id);
    const chat = await prisma.directChat.create({
      data: { user1Id, user2Id, participants: { create: [{ userId: alice.id }, { userId: bob.id }] } },
    });
    directChatId = chat.id;
    const room = await prisma.room.create({
      data: {
        name: 'team',
        ownerId: alice.id,
        members: { create: [{ userId: alice.id, role: 'OWNER' }, { userId: bob.id, role: 'MEMBER' }] },
      },
    });
    roomId = room.id;
    [aliceClient, bobClient] = await Promise.all([connect(alice), connect(bob)]);
  });

  afterEach(() => {
    aliceClient?.disconnect();
    bobClient?.disconnect();
  });

  it('direct:send with attachmentId delivers the server-owned metadata, a derived type and a signed URL', async () => {
    const { attachment } = (await upload(alice, Buffer.from('%PDF-1.4 spec'), 'spec.pdf').expect(201)).body;
    const received = waitForEvent(bobClient, SOCKET_EVENTS.DIRECT_RECEIVE);

    const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, {
      directChatId,
      content: 'Here is the spec',
      attachmentId: attachment.id,
    });

    expect(ack.success).toBe(true);
    const message = await received;
    expect(message).toMatchObject({
      content: 'Here is the spec',
      type: MessageType.DOCUMENT,
      attachment: {
        id: attachment.id,
        kind: 'DOCUMENT',
        mimeType: 'application/pdf',
        size: 13,
        name: 'spec.pdf',
        urlExpiresAt: new Date(now + TTL_SECONDS * 1000).toISOString(),
      },
    });
    expect(message).not.toHaveProperty('attachmentUrl');
    expect(server.storage.read(message.attachment.url)?.toString()).toBe('%PDF-1.4 spec');
  });

  it('room:send with an image attachmentId is broadcast as an IMAGE message', async () => {
    const { attachment } = (await upload(alice, PNG_1X1, 'dot.png').expect(201)).body;
    const received = waitForEvent(bobClient, SOCKET_EVENTS.ROOM_RECEIVE);

    const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.ROOM_SEND, { roomId, attachmentId: attachment.id });

    expect(ack.success).toBe(true);
    const message = await received;
    expect(message.type).toBe(MessageType.IMAGE);
    expect(message.attachment).toMatchObject({ id: attachment.id, kind: 'IMAGE', mimeType: 'image/png', name: 'dot.png' });
    expect(server.storage.read(message.attachment.url)).toBeDefined();
  });

  it('cuts an uploaded file name to 255 characters', async () => {
    const res = await upload(alice, Buffer.from('%PDF-1.4'), `${'n'.repeat(300)}.pdf`).expect(201);

    expect(res.body.attachment.name).toBe('n'.repeat(255));
  });

  it('A18: attachmentUrl "javascript:..." with attachmentSize -5 is refused', async () => {
    const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, {
      directChatId,
      content: 'click me',
      type: MessageType.DOCUMENT,
      attachmentUrl: 'javascript:alert(document.cookie)',
      attachmentName: 'invoice.pdf',
      attachmentSize: -5,
    });

    expect(ack).toMatchObject(errorAck('VALIDATION_ERROR'));
    expect(ack.fields.map((f: { field: string }) => f.field)).toEqual(
      expect.arrayContaining(['type', 'attachmentUrl', 'attachmentName', 'attachmentSize'])
    );
  });

  it('A19: an attachmentName of 200,000 characters is refused and nothing is sent', async () => {
    let bobReceived = false;
    bobClient.on(SOCKET_EVENTS.ROOM_RECEIVE, () => {
      bobReceived = true;
    });

    // Over the 64KB packet cap: the server drops the connection before the payload is parsed.
    await expect(
      emitWithAck(aliceClient, SOCKET_EVENTS.ROOM_SEND, { roomId, content: 'big name', attachmentName: 'x'.repeat(200_000) })
    ).rejects.toThrow();
    // Under the cap, the field itself is refused.
    const retry = await connect(alice);
    const ack = await emitWithAck(retry, SOCKET_EVENTS.ROOM_SEND, {
      roomId,
      content: 'big name',
      attachmentName: 'x'.repeat(20_000),
    });
    retry.disconnect();

    expect(ack).toMatchObject(errorAck('VALIDATION_ERROR'));
    expect(ack.fields).toEqual([{ field: 'attachmentName', message: expect.any(String) }]);
    const history = await request(server.app)
      .get(`/api/rooms/${roomId}/messages`)
      .set(bob.session)
      .expect(200);
    expect(history.body.messages).toEqual([]);
    expect(bobReceived).toBe(false);
  });

  it('A20: a javascript: GIF and a GIF from another host are refused', async () => {
    for (const gifUrl of ['javascript:alert(1)', 'https://evil.example/cat.gif', 'http://media.giphy.com/media/x/giphy.gif']) {
      const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, { directChatId, gifUrl });
      expect(ack).toMatchObject(errorAck('VALIDATION_ERROR'));
      expect(ack.fields).toEqual([{ field: 'gifUrl', message: expect.any(String) }]);
    }
  });

  it('a Giphy gifUrl is sent as an EMOJI_GIF message', async () => {
    const gifUrl = 'https://media2.giphy.com/media/abc/giphy.gif';
    const received = waitForEvent(bobClient, SOCKET_EVENTS.ROOM_RECEIVE);

    const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.ROOM_SEND, { roomId, gifUrl });

    expect(ack.success).toBe(true);
    expect(await received).toMatchObject({ type: MessageType.EMOJI_GIF, content: gifUrl, attachment: null });
  });

  it("refuses someone else's attachmentId with ATTACHMENT_INVALID", async () => {
    const { attachment } = (await upload(mallory).expect(201)).body;

    const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, { directChatId, attachmentId: attachment.id });

    expect(ack).toEqual(errorAck('ATTACHMENT_INVALID'));
  });

  it('refuses an attachmentId that does not exist with ATTACHMENT_INVALID', async () => {
    const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.ROOM_SEND, {
      roomId,
      attachmentId: '00000000-0000-4000-8000-000000000000',
    });

    expect(ack).toEqual(errorAck('ATTACHMENT_INVALID'));
  });

  it('refuses to attach one Attachment to a second message, and the second message is not sent', async () => {
    const { attachment } = (await upload(alice).expect(201)).body;
    const first = await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, { directChatId, attachmentId: attachment.id });
    expect(first.success).toBe(true);

    const again = await emitWithAck(aliceClient, SOCKET_EVENTS.ROOM_SEND, { roomId, content: 'reuse', attachmentId: attachment.id });

    expect(again).toEqual(errorAck('ATTACHMENT_INVALID'));
    const history = await request(server.app)
      .get(`/api/rooms/${roomId}/messages`)
      .set(alice.session)
      .expect(200);
    expect(history.body.messages).toEqual([]);
  });

  it('still applies the Message Character Limit to the caption', async () => {
    const { attachment } = (await upload(bob).expect(201)).body;

    const ack = await emitWithAck(bobClient, SOCKET_EVENTS.ROOM_SEND, {
      roomId,
      content: 'c'.repeat(2001),
      attachmentId: attachment.id,
    });

    expect(ack).toEqual(errorAck('MESSAGE_TOO_LONG'));
  });

  it('history and Catch-up Sync carry the Attachment with a freshly signed URL', async () => {
    const before = await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, { directChatId, content: 'file coming' });
    const { attachment } = (await upload(alice).expect(201)).body;
    await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, { directChatId, attachmentId: attachment.id });
    now += 10 * 60 * 1000;
    const freshExpiry = new Date(now + TTL_SECONDS * 1000).toISOString();

    const history = await request(server.app)
      .get(`/api/direct-chats/${directChatId}/messages`)
      .set(bob.session)
      .expect(200);
    const catchUp = await request(server.app)
      .get(`/api/direct-chats/${directChatId}/messages?after=${before.message.id}`)
      .set(bob.session)
      .expect(200);

    const fromHistory = history.body.messages.find((m: any) => m.attachment);
    expect(catchUp.body.messages).toHaveLength(1);
    for (const message of [fromHistory, catchUp.body.messages[0]]) {
      expect(message.attachment).toMatchObject({ id: attachment.id, urlExpiresAt: freshExpiry });
      expect(server.storage.read(message.attachment.url)?.toString()).toBe('%PDF-1.4 quarterly report');
    }
  });

  it('a signed URL stops working after the TTL', async () => {
    const { attachment } = (await upload(alice).expect(201)).body;
    expect(server.storage.read(attachment.url)).toBeDefined();

    now += (TTL_SECONDS + 1) * 1000;

    expect(server.storage.read(attachment.url)).toBeUndefined();
  });

  describe('GET /api/attachments/:id/url (refresh)', () => {
    function refresh(user: TestUser | null, attachmentId: string) {
      const req = request(server.app).get(`/api/attachments/${attachmentId}/url`);
      return user ? req.set(user.session) : req;
    }

    async function sendToRoom(): Promise<string> {
      const { attachment } = (await upload(alice).expect(201)).body;
      const ack = await emitWithAck(aliceClient, SOCKET_EVENTS.ROOM_SEND, { roomId, attachmentId: attachment.id });
      expect(ack.success).toBe(true);
      return attachment.id;
    }

    it('gives a Direct Chat Participant a new URL once the old one expired', async () => {
      const { attachment } = (await upload(alice).expect(201)).body;
      await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, { directChatId, attachmentId: attachment.id });
      now += (TTL_SECONDS + 1) * 1000;
      expect(server.storage.read(attachment.url)).toBeUndefined();

      const res = await refresh(bob, attachment.id).expect(200);

      expect(res.body).toEqual({ url: expect.any(String), expiresAt: new Date(now + TTL_SECONDS * 1000).toISOString() });
      expect(server.storage.read(res.body.url)?.toString()).toBe('%PDF-1.4 quarterly report');
    });

    it('gives a current Room Member a URL', async () => {
      const attachmentId = await sendToRoom();

      const res = await refresh(bob, attachmentId).expect(200);

      expect(server.storage.read(res.body.url)).toBeDefined();
    });

    it('gives the uploader a URL for their own Attachment that is not sent yet', async () => {
      const { attachment } = (await upload(alice).expect(201)).body;

      await refresh(alice, attachment.id).expect(200);
    });

    it('answers 404 to an outsider, whether the Attachment is in a Direct Chat, a Room or not sent', async () => {
      const { attachment: direct } = (await upload(alice).expect(201)).body;
      await emitWithAck(aliceClient, SOCKET_EVENTS.DIRECT_SEND, { directChatId, attachmentId: direct.id });
      const inRoom = await sendToRoom();
      const { attachment: unsent } = (await upload(alice).expect(201)).body;

      for (const id of [direct.id, inRoom, unsent.id]) {
        const res = await refresh(mallory, id).expect(404);
        expect(res.body).not.toHaveProperty('url');
      }
    });

    it('answers 404 for an Attachment that does not exist, like for one the caller may not see', async () => {
      const missing = await refresh(alice, '00000000-0000-4000-8000-000000000000').expect(404);
      const { attachment } = (await upload(alice).expect(201)).body;
      const forbidden = await refresh(bob, attachment.id).expect(404);

      expect(forbidden.body.message).toBe(missing.body.message);
      expect(forbidden.body.code).toBe(missing.body.code);
    });

    it('answers 404 to a Room Member who was just kicked', async () => {
      const attachmentId = await sendToRoom();
      await refresh(bob, attachmentId).expect(200);

      await request(server.app)
        .delete(`/api/rooms/${roomId}/members/${bob.id}`)
        .set(alice.session)
        .expect(200);

      await refresh(bob, attachmentId).expect(404);
    });

    it('requires authentication', async () => {
      const { attachment } = (await upload(alice).expect(201)).body;

      await refresh(null, attachment.id).expect(401);
    });
  });
});
