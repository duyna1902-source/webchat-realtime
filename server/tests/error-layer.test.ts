import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestServer, generateToken, TestServer } from './helpers/server.js';
import { createLogSink, LogSink } from './helpers/log-sink.js';
import { InMemoryStorageAdapter } from '../src/lib/storage.js';
import { getPrisma } from '../src/lib/prisma.js';

let app: Express;

beforeAll(async () => {
  ({ app } = await createTestServer());
});

describe('Error layer (SEC-05, SEC-09)', () => {
  let token: string;

  beforeEach(async () => {
    const user = await getPrisma().user.create({
      data: { username: 'err_user', email: 'err@test.com', passwordHash: 'hash' },
    });
    token = generateToken({ userId: user.id, username: user.username });
  });

  it('A25/A26: a malformed room payload returns a generic 500 and the server keeps answering /health', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x', description: 12345 })
      .timeout(3000);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId: res.headers['x-request-id'],
    });
    expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);

    await request(app).get('/health').expect(200);
  });

  it('A24: a JSON body over the limit returns 413 with a generic error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ emailOrUsername: 'a'.repeat(200 * 1024), password: 'x' }));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      message: 'Request body is too large',
      code: 'PAYLOAD_TOO_LARGE',
      requestId: res.headers['x-request-id'],
    });
  });

  it('malformed JSON returns 400 without the parser message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"emailOrUsername": "alice", ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'Request body is not valid JSON',
      code: 'INVALID_JSON',
      requestId: res.headers['x-request-id'],
    });
  });

  it('A07: a Prisma failure does not leak query or model details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: { a: 1 }, email: 'a07@test.com', password: 'password123' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(Object.keys(res.body).sort()).toEqual(['code', 'message', 'requestId']);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|invocation|findUnique|Argument/i);
  });

  it('every response carries a distinct X-Request-Id', async () => {
    const first = await request(app).get('/health').expect(200);
    const second = await request(app).get('/health').expect(200);

    expect(first.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });
});

class FailingStorageAdapter extends InMemoryStorageAdapter {
  async put(): Promise<never> {
    throw new Error('Supabase bucket "private-attachments" rejected path 2026/secret.pdf');
  }
}

describe('Error logging', () => {
  let sink: LogSink;
  let server: TestServer;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    sink = createLogSink();
    server = await createTestServer({ logger: sink.logger, storage: new FailingStorageAdapter() });
  });

  beforeEach(async () => {
    const user = await getPrisma().user.create({
      data: { username: 'log_user', email: 'log@test.com', passwordHash: 'hash' },
    });
    userId = user.id;
    token = generateToken({ userId: user.id, username: user.username });
  });

  it('a storage failure is hidden from the client but logged with stack, requestId and userId', async () => {
    const res = await request(server.app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId: res.headers['x-request-id'],
    });
    expect(res.text).not.toMatch(/bucket|private-attachments|at /);

    const entry = sink.entries().find((e) => e.requestId === res.body.requestId && e.level >= 50);
    expect(entry).toBeDefined();
    expect(entry!.userId).toBe(userId);
    expect(entry!.ip).toBeTruthy();
    expect(entry!.err.message).toContain('private-attachments');
    expect(entry!.err.stack).toMatch(/at /);
  });
});
