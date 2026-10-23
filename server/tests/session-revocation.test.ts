import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { SOCKET_EVENTS } from '@webchat/shared';
import { createTestServer, createLoggedInUser, loginAs, TestServer, SessionHeaders } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { createSessionStore } from '../src/lib/session-store.js';
import { runRevokeSessionsCommand } from '../src/lib/revoke-sessions-command.js';

function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The `__Host-session` Set-Cookie line of a response, or undefined. */
function sessionSetCookie(res: request.Response): string | undefined {
  const lines = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return lines.find((line) => line.startsWith('__Host-session='));
}

describe('Logout everywhere and Session revocation (SEC-11, Q24, Q45)', () => {
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

  const me = (headers: SessionHeaders) => request(server.app).get('/api/auth/me').set(headers);

  async function connect(headers: SessionHeaders): Promise<ClientSocketType> {
    const client = ClientSocket(url, { extraHeaders: headers, transports: ['websocket'], reconnection: false });
    clients.push(client);
    await waitForEvent(client, 'connect');
    return client;
  }

  it('POST /api/auth/logout-all returns 204, clears the cookie, and ends every Session of the User', async () => {
    const { user, headers: laptop } = await createLoggedInUser(server.app, { username: 'alice_all' });
    const phone = await loginAs(server.app, user);

    const res = await request(server.app).post('/api/auth/logout-all').set(laptop).expect(204);

    expect(sessionSetCookie(res)!.split(';')[0]).toBe('__Host-session=');
    await me(laptop).expect(401);
    await me(phone).expect(401);
  });

  it('logout-all on one device disconnects the socket on the other device, whose cookie is then 401', async () => {
    const { user, headers: laptop } = await createLoggedInUser(server.app, { username: 'dana_devices' });
    const phone = await loginAs(server.app, user);
    const laptopSocket = await connect(laptop);
    const phoneSocket = await connect(phone);
    const phoneEnded = waitForEvent(phoneSocket, SOCKET_EVENTS.SESSION_ENDED);
    const phoneDisconnected = waitForEvent<string>(phoneSocket, 'disconnect');
    const laptopDisconnected = waitForEvent<string>(laptopSocket, 'disconnect');

    await request(server.app).post('/api/auth/logout-all').set(laptop).expect(204);

    expect(await phoneEnded).toEqual({ reason: 'revoked' });
    expect(await phoneDisconnected).toBe('io server disconnect');
    expect(await laptopDisconnected).toBe('io server disconnect');
    await me(phone).expect(401);
  });

  it('a disconnected device cannot reconnect its socket after logout-all', async () => {
    const { user, headers: laptop } = await createLoggedInUser(server.app, { username: 'eli_reconnect' });
    const phone = await loginAs(server.app, user);
    await request(server.app).post('/api/auth/logout-all').set(laptop).expect(204);

    const client = ClientSocket(url, { extraHeaders: phone, transports: ['websocket'], reconnection: false });
    clients.push(client);
    const err = await waitForEvent<Error>(client, 'connect_error');
    expect(err.message).toMatch(/authentication required/i);
  });

  it('logging out one Session disconnects only that Session\'s sockets', async () => {
    const { user, headers: laptop } = await createLoggedInUser(server.app, { username: 'fay_single' });
    const phone = await loginAs(server.app, user);
    const laptopSocket = await connect(laptop);
    const phoneSocket = await connect(phone);
    const laptopDisconnected = waitForEvent<string>(laptopSocket, 'disconnect');
    let phoneDropped = false;
    phoneSocket.on('disconnect', () => (phoneDropped = true));

    await request(server.app).post('/api/auth/logout').set(laptop).expect(204);

    expect(await laptopDisconnected).toBe('io server disconnect');
    await pause(200);
    expect(phoneDropped).toBe(false);
    expect(phoneSocket.connected).toBe(true);
    await me(phone).expect(200);
  });

  it('logout-all leaves other Users signed in', async () => {
    const { headers: alice } = await createLoggedInUser(server.app, { username: 'alice_other' });
    const { headers: bob } = await createLoggedInUser(server.app, { username: 'bob_other' });

    await request(server.app).post('/api/auth/logout-all').set(alice).expect(204);

    await me(bob).expect(200);
  });

  it('logout-all without a Session is 401', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'carol_none' });
    await request(server.app).post('/api/auth/logout').set(headers).expect(204);

    await request(server.app).post('/api/auth/logout-all').set(headers).expect(401);
  });
});

describe('Absolute Session expiry cuts off the socket (Q24)', () => {
  let server: TestServer;
  const clients: ClientSocketType[] = [];

  beforeAll(async () => {
    server = await createTestServer({ listen: true, config: { timing: { sessionAbsoluteTtlMs: 1500 } } });
  });

  afterAll(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await server.close();
  });

  it('disconnects the socket the moment its Session reaches the absolute TTL', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'gus_expiry' });
    const loggedInAt = Date.now();
    const client = ClientSocket(`http://localhost:${server.port}`, { extraHeaders: headers, transports: ['websocket'], reconnection: false });
    clients.push(client);
    await waitForEvent(client, 'connect');
    const ended = waitForEvent(client, SOCKET_EVENTS.SESSION_ENDED, 4000);
    const disconnected = waitForEvent<string>(client, 'disconnect', 4000);

    expect(await ended).toEqual({ reason: 'expired' });
    expect(await disconnected).toBe('io server disconnect');
    // On time, not at some later sweep.
    expect(Date.now() - loggedInAt).toBeLessThan(2500);
    await request(server.app).get('/api/auth/me').set(headers).expect(401);
  });
});

describe('Operator CLI: revoke Sessions (incident response)', () => {
  let server: TestServer;
  let url: string;
  const clients: ClientSocketType[] = [];

  beforeAll(async () => {
    // The CLI runs in another process, so its revocations reach open sockets through the re-check.
    server = await createTestServer({ listen: true, config: { timing: { sessionRecheckIntervalMs: 100 } } });
    url = `http://localhost:${server.port}`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.disconnect();
  });

  afterAll(async () => {
    await server.close();
  });

  /** The command as the npm script runs it: its own Session store over the same DB. */
  async function revokeCommand(...argv: string[]): Promise<string[]> {
    const output: string[] = [];
    const { timing } = server.config;
    await runRevokeSessionsCommand(argv, {
      prisma: getPrisma(),
      sessions: createSessionStore({
        prisma: getPrisma(),
        idleTtlMs: timing.sessionIdleTtlMs,
        absoluteTtlMs: timing.sessionAbsoluteTtlMs,
        touchIntervalMs: timing.sessionTouchIntervalMs,
      }),
      log: (line) => output.push(line),
    });
    return output;
  }

  async function connect(headers: SessionHeaders): Promise<ClientSocketType> {
    const client = ClientSocket(url, { extraHeaders: headers, transports: ['websocket'], reconnection: false });
    clients.push(client);
    await waitForEvent(client, 'connect');
    return client;
  }

  const me = (headers: SessionHeaders) => request(server.app).get('/api/auth/me').set(headers);

  it('--user <username> revokes only that User\'s Sessions, prints the count, and cuts off their open sockets', async () => {
    const { user, headers: laptop } = await createLoggedInUser(server.app, { username: 'hana_cli' });
    const phone = await loginAs(server.app, user);
    const { headers: bystander } = await createLoggedInUser(server.app, { username: 'ivo_cli' });
    const hanaSocket = await connect(phone);
    const bystanderSocket = await connect(bystander);
    const ended = waitForEvent(hanaSocket, SOCKET_EVENTS.SESSION_ENDED);

    const output = await revokeCommand('--user', 'hana_cli');

    expect(output.join('\n')).toMatch(/revoked 2 sessions/i);
    expect(await ended).toEqual({ reason: 'revoked' });
    await me(laptop).expect(401);
    await me(phone).expect(401);
    await me(bystander).expect(200);
    await pause(300);
    expect(bystanderSocket.connected).toBe(true);
  });

  it('--user <id> works with the User id', async () => {
    const { user, headers } = await createLoggedInUser(server.app, { username: 'jon_cli' });

    const output = await revokeCommand('--user', user.id);

    expect(output.join('\n')).toMatch(/revoked 1 session\b/i);
    await me(headers).expect(401);
  });

  it('--all revokes every Session of every User', async () => {
    const { headers: kai } = await createLoggedInUser(server.app, { username: 'kai_cli' });
    const { headers: lea } = await createLoggedInUser(server.app, { username: 'lea_cli' });
    const leaSocket = await connect(lea);
    const ended = waitForEvent(leaSocket, SOCKET_EVENTS.SESSION_ENDED);
    const existing = await getPrisma().session.count();

    const output = await revokeCommand('--all');

    expect(output.join('\n')).toMatch(new RegExp(`revoked ${existing} sessions`, 'i'));
    await ended;
    await me(kai).expect(401);
    await me(lea).expect(401);
  });

  it('refuses an unknown User, missing arguments, or both --user and --all, and revokes nothing', async () => {
    const { headers } = await createLoggedInUser(server.app, { username: 'max_cli' });

    await expect(revokeCommand('--user', 'nobody_here')).rejects.toThrow(/no user/i);
    await expect(revokeCommand()).rejects.toThrow(/usage/i);
    await expect(revokeCommand('--user')).rejects.toThrow(/usage/i);
    await expect(revokeCommand('--all', '--user', 'max_cli')).rejects.toThrow(/usage/i);
    await me(headers).expect(200);
  });
});
