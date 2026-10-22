import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import request from 'supertest';
import { installProcessHandlers } from '../src/lib/logger.js';
import { createLogSink } from './helpers/log-sink.js';
import { createTestServer } from './helpers/server.js';

const PASSWORD = 'Hunter2-Sup3r-Passw0rd';
const COOKIE_VALUE = 'cookie-value-7f3a9c';
const BEARER = 'bearer-value-52b1e0';
const SECRET = 'sb_secret_value_d41d8c';
const TOKEN = 'token-value-0cc175';

describe('Process safety net', () => {
  it('logs an unhandled rejection at fatal and keeps the process running', () => {
    const sink = createLogSink();
    const proc = new EventEmitter();
    const exit = vi.fn();
    installProcessHandlers(proc, sink.logger, exit);

    proc.emit('unhandledRejection', new Error('rejected somewhere'));

    const [entry] = sink.entries();
    expect(entry.level).toBe(60);
    expect(entry.err.message).toBe('rejected somewhere');
    expect(entry.err.stack).toMatch(/at /);
    expect(exit).not.toHaveBeenCalled();
  });

  it('logs an uncaught exception at fatal, then exits', () => {
    const sink = createLogSink();
    const proc = new EventEmitter();
    const exit = vi.fn();
    installProcessHandlers(proc, sink.logger, exit);

    proc.emit('uncaughtException', new Error('thrown somewhere'));

    const [entry] = sink.entries();
    expect(entry.level).toBe(60);
    expect(entry.err.message).toBe('thrown somewhere');
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('Logger redaction (SEC-17)', () => {
  it('redacts password, cookie, set-cookie, authorization and any key containing secret or token', () => {
    const sink = createLogSink();

    sink.logger.info(
      {
        password: PASSWORD,
        headers: {
          cookie: `__Host-session=${COOKIE_VALUE}`,
          authorization: `Bearer ${BEARER}`,
          'set-cookie': [`__Host-session=${COOKIE_VALUE}; HttpOnly`],
        },
        storage: { supabaseSecretKey: SECRET },
        attempts: [{ refresh_token: TOKEN }],
      },
      'login attempt'
    );
    sink.logger.child({ sessionToken: TOKEN }).warn('child bindings');

    const text = sink.text();
    for (const value of [PASSWORD, COOKIE_VALUE, BEARER, SECRET, TOKEN]) {
      expect(text).not.toContain(value);
    }
    const [entry] = sink.entries();
    expect(entry.password).toBe('[Redacted]');
    expect(entry.headers.cookie).toBe('[Redacted]');
    expect(entry.headers['set-cookie']).toBe('[Redacted]');
    expect(entry.msg).toBe('login attempt');
  });

  it('redacts sensitive fields attached to logged errors but keeps the stack', () => {
    const sink = createLogSink();
    const err = Object.assign(new Error('upstream failed'), {
      request: { headers: { Authorization: `Bearer ${BEARER}`, apikey: 'public' }, secretKey: SECRET },
    });

    sink.logger.error({ err }, 'storage call failed');

    expect(sink.text()).not.toContain(BEARER);
    expect(sink.text()).not.toContain(SECRET);
    const [entry] = sink.entries();
    expect(entry.err.message).toBe('upstream failed');
    expect(entry.err.type).toBe('Error');
    expect(entry.err.stack).toMatch(/at /);
    expect(entry.err.request.headers.apikey).toBe('public');
  });

  it('logs no password or cookie value while serving auth requests, even on a 5xx', async () => {
    const sink = createLogSink();
    const { app } = await createTestServer({ logger: sink.logger });

    await request(app)
      .post('/api/auth/register')
      .set('Cookie', `__Host-session=${COOKIE_VALUE}`)
      .send({ username: 'log_alice', email: 'log_alice@test.com', password: PASSWORD })
      .expect(201);
    await request(app)
      .post('/api/auth/login')
      .set('Cookie', `__Host-session=${COOKIE_VALUE}`)
      .send({ emailOrUsername: 'log_alice', password: PASSWORD })
      .expect(200);
    const failed = await request(app)
      .post('/api/auth/register')
      .set('Cookie', `__Host-session=${COOKIE_VALUE}`)
      .send({ username: { a: 1 }, email: 'log_bob@test.com', password: PASSWORD });

    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect(sink.entries().some((e) => e.requestId === failed.body.requestId)).toBe(true);
    expect(sink.text()).not.toContain(PASSWORD);
    expect(sink.text()).not.toContain(COOKIE_VALUE);
  });
});
