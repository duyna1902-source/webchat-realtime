import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createTestServer, generateToken } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import { SOCKET_EVENTS, PresenceUpdatePayload } from '@webchat/shared';
import { clearPresenceState } from '../src/socket/presence.handler.js';

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

describe('Presence Management & Grace Period Integration', { timeout: 30000 }, () => {
  let httpServer: http.Server;
  let serverPort: number;
  let clientAlice: ClientSocketType;
  let clientBob: ClientSocketType;
  let userAlice: any;
  let userBob: any;

  beforeAll(async () => {
    // Configure 250ms grace period for fast integration testing
    ({ httpServer, port: serverPort } = await createTestServer({
      listen: true,
      config: { timing: { presenceGracePeriodMs: 250 } },
    }));
  });

  afterEach(() => {
    clearPresenceState();
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
  });

  afterAll(async () => {
    clearPresenceState();
    if (clientAlice?.connected) clientAlice.disconnect();
    if (clientBob?.connected) clientBob.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    clearPresenceState();
    const prisma = getPrisma();

    userAlice = await prisma.user.create({
      data: { username: 'alice', email: 'alice@test.com', passwordHash: 'hash', isOnline: false },
    });
    userBob = await prisma.user.create({
      data: { username: 'bob', email: 'bob@test.com', passwordHash: 'hash', isOnline: false },
    });
  });

  it('broadcasts presence:update with isOnline: true and updates DB when user connects', async () => {
    const tokenBob = generateToken({ userId: userBob.id, username: userBob.username });
    clientBob = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenBob },
      transports: ['websocket'],
    });

    await waitForEvent(clientBob, 'connect');

    // Bob listens for Alice's presence update
    const presencePromise = waitForEvent<PresenceUpdatePayload>(clientBob, SOCKET_EVENTS.PRESENCE_UPDATE);

    // Alice connects
    const tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    clientAlice = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });

    const event = await presencePromise;
    expect(event).toMatchObject({
      userId: userAlice.id,
      isOnline: true,
    });

    // Check DB User.isOnline
    const prisma = getPrisma();
    const dbAlice = await prisma.user.findUnique({ where: { id: userAlice.id } });
    expect(dbAlice?.isOnline).toBe(true);
  });

  it('delays marking user offline and broadcasting until grace period expires', async () => {
    const tokenBob = generateToken({ userId: userBob.id, username: userBob.username });
    clientBob = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenBob },
      transports: ['websocket'],
    });
    await waitForEvent(clientBob, 'connect');

    const tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    clientAlice = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });
    await waitForEvent(clientAlice, 'connect');

    let offlineEventReceivedTooEarly = false;
    clientBob.on(SOCKET_EVENTS.PRESENCE_UPDATE, (data: PresenceUpdatePayload) => {
      if (data.userId === userAlice.id && !data.isOnline) {
        offlineEventReceivedTooEarly = true;
      }
    });

    // Alice disconnects
    clientAlice.disconnect();

    // After 30ms (well within 100ms grace period), Alice should NOT be marked offline
    await new Promise((r) => setTimeout(r, 30));
    expect(offlineEventReceivedTooEarly).toBe(false);

    const prisma = getPrisma();
    let dbAlice = await prisma.user.findUnique({ where: { id: userAlice.id } });
    expect(dbAlice?.isOnline).toBe(true);

    // Now wait for the offline event after grace period expires
    const offlineEventPromise = waitForEvent<PresenceUpdatePayload>(
      clientBob,
      SOCKET_EVENTS.PRESENCE_UPDATE,
      2000
    );

    const offlineEvent = await offlineEventPromise;
    expect(offlineEvent).toMatchObject({
      userId: userAlice.id,
      isOnline: false,
    });
    expect(offlineEvent.lastSeenAt).toBeDefined();

    dbAlice = await prisma.user.findUnique({ where: { id: userAlice.id } });
    expect(dbAlice?.isOnline).toBe(false);
  });

  it('cancels grace period and keeps user online if user reconnects before grace period expires', async () => {
    const tokenBob = generateToken({ userId: userBob.id, username: userBob.username });
    clientBob = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenBob },
      transports: ['websocket'],
    });
    await waitForEvent(clientBob, 'connect');

    const tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    clientAlice = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });
    await waitForEvent(clientAlice, 'connect');

    let offlineBroadcast = false;
    clientBob.on(SOCKET_EVENTS.PRESENCE_UPDATE, (data: PresenceUpdatePayload) => {
      if (data.userId === userAlice.id && !data.isOnline) {
        offlineBroadcast = true;
      }
    });

    // Alice disconnects
    clientAlice.disconnect();

    // Reconnect within grace period (at 40ms, grace period is 250ms)
    await new Promise((r) => setTimeout(r, 40));

    const clientAliceReconnect = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });
    await waitForEvent(clientAliceReconnect, 'connect');

    // Wait past the original 250ms grace period window (wait 300ms)
    await new Promise((r) => setTimeout(r, 300));

    // Verify Alice was never broadcast as offline
    expect(offlineBroadcast).toBe(false);

    const prisma = getPrisma();
    const dbAlice = await prisma.user.findUnique({ where: { id: userAlice.id } });
    expect(dbAlice?.isOnline).toBe(true);

    clientAliceReconnect.disconnect();
  });

  it('keeps user online when one of multiple devices/tabs disconnects', async () => {
    const tokenBob = generateToken({ userId: userBob.id, username: userBob.username });
    clientBob = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenBob },
      transports: ['websocket'],
    });
    await waitForEvent(clientBob, 'connect');

    const tokenAlice = generateToken({ userId: userAlice.id, username: userAlice.username });
    // Alice connects tab 1
    const aliceTab1 = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });
    // Alice connects tab 2
    const aliceTab2 = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: tokenAlice },
      transports: ['websocket'],
    });

    await Promise.all([waitForEvent(aliceTab1, 'connect'), waitForEvent(aliceTab2, 'connect')]);

    let offlineBroadcast = false;
    clientBob.on(SOCKET_EVENTS.PRESENCE_UPDATE, (data: PresenceUpdatePayload) => {
      if (data.userId === userAlice.id && !data.isOnline) {
        offlineBroadcast = true;
      }
    });

    // Disconnect tab 1
    aliceTab1.disconnect();

    // Wait past grace period
    await new Promise((r) => setTimeout(r, 150));

    // Alice is still online on tab 2!
    expect(offlineBroadcast).toBe(false);

    const prisma = getPrisma();
    const dbAlice = await prisma.user.findUnique({ where: { id: userAlice.id } });
    expect(dbAlice?.isOnline).toBe(true);

    aliceTab2.disconnect();
  });
});
