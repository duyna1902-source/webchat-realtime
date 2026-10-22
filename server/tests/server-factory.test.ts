import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as ClientSocket } from 'socket.io-client';
import { getPrisma } from '../src/lib/prisma.js';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { createTestServer, loginAs, sessionCookieOf, TestServer, TEST_APP_ORIGIN, TEST_PASSWORD } from './helpers/server.js';

describe('Server factory', () => {
  let server: TestServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('returns an HTTP server with Express and Socket.IO attached', async () => {
    server = await createTestServer({ listen: true });
    const user = await getPrisma().user.create({
      data: { username: 'factory_user', email: 'factory@test.com', passwordHash: 'hash' },
    });

    const health = await fetch(`http://localhost:${server.port}/health`);
    expect(health.status).toBe(200);

    const client = ClientSocket(`http://localhost:${server.port}`, {
      extraHeaders: await loginAs(server.app, user),
      transports: ['websocket'],
    });
    try {
      await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve());
        client.once('connect_error', reject);
      });
      expect(client.connected).toBe(true);
    } finally {
      client.disconnect();
    }
  });

  it('takes the Session lifetime and the app origin from the injected config only', async () => {
    const appOrigin = 'https://injected.example';
    server = await createTestServer({ config: { appOrigin, timing: { sessionAbsoluteTtlMs: 60_000 } } });
    const user = await getPrisma().user.create({
      data: { username: 'config_user', email: 'config@test.com', passwordHash: 'hash' },
    });
    await loginAs(server.app, user).catch(() => undefined); // sets TEST_PASSWORD; fails on the default Origin

    const login = (origin: string) =>
      request(server!.app).post('/api/auth/login').set('Origin', origin).send({ emailOrUsername: 'config_user', password: TEST_PASSWORD });

    await login(TEST_APP_ORIGIN).expect(403);
    const res = await login(appOrigin).expect(200);
    expect(res.headers['set-cookie'][0]).toMatch(/Max-Age=60;/);
    expect(sessionCookieOf(res)).toMatch(/^__Host-session=/);
  });

  it('stores uploads through the injected storage adapter', async () => {
    const storage = new InMemoryStorageAdapter();
    server = await createTestServer({ storage });
    const user = await getPrisma().user.create({
      data: { username: 'upload_user', email: 'upload@test.com', passwordHash: 'hash' },
    });
    const session = await loginAs(server.app, user);

    const res = await request(server.app)
      .post('/api/upload')
      .set(session)
      .attach('file', Buffer.from('%PDF-1.4 in memory'), { filename: 'doc.pdf', contentType: 'application/pdf' })
      .expect(200);

    expect(storage.read(res.body.url)?.toString()).toBe('%PDF-1.4 in memory');
  });

  it('serves the client build from the configured directory', async () => {
    const clientDist = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-factory-dist-'));
    fs.writeFileSync(path.join(clientDist, 'index.html'), '<!doctype html><title>spa-shell</title>');
    try {
      server = await createTestServer({ config: { clientDistPath: clientDist } });

      const res = await request(server.app).get('/rooms/some-room').expect(200);
      expect(res.text).toContain('spa-shell');
    } finally {
      fs.rmSync(clientDist, { recursive: true, force: true });
    }
  });
});
