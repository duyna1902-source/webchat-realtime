import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { io as ClientSocket, Socket as ClientSocketType, ManagerOptions, SocketOptions } from 'socket.io-client';
import { createTestServer, createLoggedInUser, TestServer, TEST_APP_ORIGIN, SessionHeaders } from './helpers/server.js';

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

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Socket.IO handshake: Origin and Session cookie (SEC-11, Q45)', () => {
  let server: TestServer;
  let url: string;
  const clients: ClientSocketType[] = [];

  beforeAll(async () => {
    server = await createTestServer({ listen: true });
    url = `http://localhost:${server.port}`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.disconnect();
  });

  afterAll(async () => {
    await server.close();
  });

  function connect(extraHeaders: Record<string, string>, options: Partial<ManagerOptions & SocketOptions> = {}): ClientSocketType {
    const client = ClientSocket(url, { extraHeaders, transports: ['websocket'], reconnection: false, ...options });
    clients.push(client);
    return client;
  }

  async function logout(headers: SessionHeaders): Promise<void> {
    await request(server.app).post('/api/auth/logout').set(headers).expect(204);
  }

  it('connects with the Session cookie and the app Origin', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'alice_socket' });
    const client = connect(headers);

    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
  });

  it('puts the socket in its session:<id> room', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'alice_rooms' });
    const client = connect(headers);
    await waitForEvent(client, 'connect');

    const [serverSocket] = await server.io.in(client.id!).fetchSockets();
    const sessionRooms = [...serverSocket.rooms].filter((room) => room.startsWith('session:'));
    expect(sessionRooms).toHaveLength(1);
  });

  it('rejects a connection without a Session cookie', async () => {
    const client = connect({ Origin: TEST_APP_ORIGIN });

    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toMatch(/authentication required/i);
    expect(client.connected).toBe(false);
  });

  it('rejects a handshake from a foreign Origin, even with a valid cookie (CSWSH)', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'bob_socket' });
    const client = connect({ ...headers, Origin: 'https://evil.example' });

    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toMatch(/forbidden origin/i);
  });

  it('rejects a handshake without Origin', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'carol_socket' });
    const client = connect({ Cookie: headers.Cookie });

    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toMatch(/forbidden origin/i);
  });

  it('rejects the old cookie after logout', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'dave_socket' });
    await logout(headers);

    const client = connect(headers);
    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toMatch(/authentication required/i);
  });

  it('A12: ignores handshake.auth.token, even a JWT signed with the old secret', async () => {
    const { user } = await createLoggedInUser(server.app, { username: 'erin_socket' });
    const forged = forgeJwt({ userId: user.id, username: user.username }, 'webchat-realtime-default-secret-key-32-chars');

    const client = connect({ Origin: TEST_APP_ORIGIN, Authorization: `Bearer ${forged}` }, { auth: { token: forged } });
    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toMatch(/authentication required/i);
  });

  describe('Connection State Recovery re-checks the Session', () => {
    /** Gives the client a buffered packet to recover from, then kills the transport. */
    async function connectThenDrop(headers: SessionHeaders): Promise<ClientSocketType> {
      const client = connect(headers);
      await waitForEvent(client, 'connect');
      const ping = waitForEvent(client, 'test:broadcast');
      server.io.emit('test:broadcast', {});
      await ping;

      const sid = client.id!;
      const disconnected = waitForEvent(client, 'disconnect');
      client.io.engine.close();
      await disconnected;
      for (let i = 0; i < 100 && server.io.sockets.sockets.has(sid); i++) await pause(10);
      return client;
    }

    it('a dropped socket with a live Session is recovered', async () => {
      const { headers } = await createLoggedInUser(server.app, { username: 'frank_socket' });
      const client = await connectThenDrop(headers);

      const connected = waitForEvent(client, 'connect');
      client.connect();
      await connected;
      expect(client.recovered).toBe(true);
    });

    it('a socket recovered after its Session was revoked is rejected', async () => {
      const { headers } = await createLoggedInUser(server.app, { username: 'gina_socket' });
      const client = await connectThenDrop(headers);

      await logout(headers);

      const rejected = waitForEvent<Error>(client, 'connect_error');
      client.connect();
      const err = await rejected;
      expect(err.message).toMatch(/authentication required/i);
      expect(client.connected).toBe(false);
    });
  });
});

/** An HS256 JWT built by hand, the way an attacker holding the secret would (A12). */
function forgeJwt(payload: Record<string, unknown>, secret: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...payload, iat: now, exp: now + 3600 })}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}
