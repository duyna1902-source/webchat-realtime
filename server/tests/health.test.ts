import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createTestServer, TestServer } from './helpers/server.js';
import { createLogSink } from './helpers/log-sink.js';

// `/health` says the process is up; `/health/ready` also says it can reach the database.

let server: TestServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('GET /health/ready', () => {
  it('answers 200 when the database answers a query', async () => {
    server = await createTestServer();

    const res = await request(server.app).get('/health/ready').expect(200);

    expect(res.body).toEqual({ status: 'ready', timestamp: expect.any(String) });
  });

  it('answers 503 when the database query fails, and logs why without telling the client', async () => {
    const sink = createLogSink();
    server = await createTestServer({
      logger: sink.logger,
      checkDatabase: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432')),
    });

    const res = await request(server.app).get('/health/ready').expect(503);

    expect(res.body).toEqual({ status: 'unavailable', timestamp: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    expect(sink.entries().some((entry) => entry.level >= 50 && JSON.stringify(entry).includes('ECONNREFUSED'))).toBe(true);
  });

  it('keeps /health as it was', async () => {
    server = await createTestServer({ checkDatabase: () => Promise.reject(new Error('down')) });

    const res = await request(server.app).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok', timestamp: expect.any(String) });
  });
});
