import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestServer, sessionCookieOf, sessionHeaders, SessionHeaders, TEST_APP_ORIGIN } from './helpers/server.js';

// Seam 1: account rules and input validation (SEC-08, SEC-05 types). Each test replays an attack
// step from the security audit (.scratch/security-audit/spec.md) and expects it to be refused.

let app: Express;

beforeAll(async () => {
  ({ app } = await createTestServer());
});

const register = (body: unknown) => request(app).post('/api/auth/register').set('Origin', TEST_APP_ORIGIN).send(body as object);
const login = (body: unknown) => request(app).post('/api/auth/login').set('Origin', TEST_APP_ORIGIN).send(body as object);

describe('Registration rules (SEC-08)', () => {
  const valid = { username: 'alice', email: 'alice@example.com', password: 'password123' };

  const expectRejected = async (body: unknown, field: string) => {
    const res = await register(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toEqual([expect.objectContaining({ field, message: expect.any(String) })]);
    expect(res.body).not.toHaveProperty('token');
    return res;
  };

  it('A02: a 1-character password is refused', async () => {
    await expectRejected({ ...valid, password: '1' }, 'password');
  });

  it('accepts a password of 8 to 72 UTF-8 bytes and refuses 73 bytes', async () => {
    await register({ ...valid, password: 'a'.repeat(8) }).expect(201);
    await register({ username: 'alice2', email: 'alice2@example.com', password: 'é'.repeat(36) }).expect(201);
    await expectRejected({ username: 'alice3', email: 'alice3@example.com', password: 'é'.repeat(36) + 'a' }, 'password');
  });

  it('A03: an email without a valid format is refused', async () => {
    await expectRejected({ ...valid, email: 'not-an-email' }, 'email');
  });

  it('stores the email in lowercase', async () => {
    const res = await register({ ...valid, email: 'Alice@Example.COM' }).expect(201);
    expect(res.body.user.email).toBe('alice@example.com');

    await expectRejected({ username: 'other', email: 'ALICE@example.com', password: 'password123' }, 'email');
  });

  it('A04: avatarUrl is not accepted from the client and never appears in the API', async () => {
    const res = await register({ ...valid, avatarUrl: 'javascript:alert(1)' }).expect(201);
    expect(res.body.user).not.toHaveProperty('avatarUrl');

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookieOf(res)).expect(200);
    expect(me.body.user).not.toHaveProperty('avatarUrl');
    expect(JSON.stringify(me.body)).not.toContain('javascript:');
  });

  it('A05: a 50,000-character username is refused', async () => {
    await expectRejected({ ...valid, username: 'a'.repeat(50_000) }, 'username');
  });

  it('A06: a username containing CR/LF is refused', async () => {
    await expectRejected({ ...valid, username: 'crlf\r\nX-Injected: 1' }, 'username');
  });

  it('A07: a username sent as an object is refused with 400 and no Prisma details', async () => {
    const res = await expectRejected({ ...valid, username: { a: 1 } }, 'username');
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|invocation|findUnique|Argument/i);
  });

  it('accepts usernames of 3 to 32 letters, digits, _ and ., and refuses others', async () => {
    await register({ ...valid, username: 'a.b' }).expect(201);
    await register({ username: 'A_'.repeat(16), email: 'b@example.com', password: 'password123' }).expect(201);
    await expectRejected({ ...valid, username: 'ab' }, 'username');
    await expectRejected({ ...valid, username: 'a'.repeat(33) }, 'username');
    await expectRejected({ ...valid, username: 'with space' }, 'username');
    await expectRejected({ ...valid, username: 'ünïcode' }, 'username');
  });

  it('refuses `Alice` when `alice` already exists (case-insensitive uniqueness)', async () => {
    await register(valid).expect(201);

    await expectRejected({ username: 'Alice', email: 'other@example.com', password: 'password123' }, 'username');
  });

  it('keeps the username as typed', async () => {
    const res = await register({ ...valid, username: 'AliceW' }).expect(201);
    expect(res.body.user.username).toBe('AliceW');
  });
});

describe('Login (SEC-08)', () => {
  beforeEach(async () => {
    await register({ username: 'bob', email: 'bob@example.com', password: 'bobpass12' }).expect(201);
  });

  it('A09: logging in with an operator object instead of a username is refused', async () => {
    const res = await login({ emailOrUsername: { contains: 'b' }, password: 'bobpass12' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toEqual([expect.objectContaining({ field: 'emailOrUsername' })]);
    expect(res.body).not.toHaveProperty('token');
  });

  it('A10: a password sent as an object is refused with 400, not a 500', async () => {
    const res = await login({ emailOrUsername: 'bob', password: { a: 1 } });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toEqual([expect.objectContaining({ field: 'password' })]);
  });

  it('answers 401 with the same body for an unknown username and for a wrong password', async () => {
    const unknownUser = await login({ emailOrUsername: 'nobody', password: 'bobpass12' });
    const wrongPassword = await login({ emailOrUsername: 'bob', password: 'wrong-password' });

    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('matches the exact username or email, ignoring letter case', async () => {
    await login({ emailOrUsername: 'BOB', password: 'bobpass12' }).expect(200);
    await login({ emailOrUsername: 'Bob@Example.com', password: 'bobpass12' }).expect(200);
    await login({ emailOrUsername: 'bo', password: 'bobpass12' }).expect(401);
    await login({ emailOrUsername: 'b%', password: 'bobpass12' }).expect(401);
  });
});

describe('Room name and description (SEC-08)', () => {
  let session: SessionHeaders;

  beforeEach(async () => {
    const res = await register({ username: 'owner', email: 'owner@example.com', password: 'password123' }).expect(201);
    session = sessionHeaders(sessionCookieOf(res));
  });

  const createRoom = (body: unknown) =>
    request(app).post('/api/rooms').set(session).send(body as object);

  const expectRejected = async (body: unknown, field: string) => {
    const res = await createRoom(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toEqual([expect.objectContaining({ field })]);
  };

  it('trims the name and accepts 1 to 64 characters', async () => {
    const res = await createRoom({ name: `  ${'n'.repeat(64)}  `, description: '  about  ' }).expect(201);
    expect(res.body.name).toBe('n'.repeat(64));
    expect(res.body.description).toBe('about');

    const emoji = await createRoom({ name: '😀'.repeat(64) }).expect(201);
    expect(emoji.body.name).toBe('😀'.repeat(64));
  });

  it('refuses a name that is empty after trimming or longer than 64 characters', async () => {
    await expectRejected({ name: '   ' }, 'name');
    await expectRejected({ name: 'n'.repeat(65) }, 'name');
    await expectRejected({ description: 'no name' }, 'name');
  });

  it('accepts a description of up to 500 characters and stores an empty one as null', async () => {
    await createRoom({ name: 'ok', description: 'd'.repeat(500) }).expect(201);
    const empty = await createRoom({ name: 'ok', description: '   ' }).expect(201);
    expect(empty.body.description).toBeNull();

    await expectRejected({ name: 'ok', description: 'd'.repeat(501) }, 'description');
  });

  it('refuses control characters in the name or the description', async () => {
    await expectRejected({ name: 'evil\r\nroom' }, 'name');
    await expectRejected({ name: 'bell\u0007' }, 'name');
    await expectRejected({ name: 'ok', description: 'line\nbreak' }, 'description');
  });

  it('member, role and direct-chat bodies accept only string ids and known roles', async () => {
    const room = await createRoom({ name: 'team' }).expect(201);
    const auth = session;

    const member = await request(app).post(`/api/rooms/${room.body.id}/members`).set(auth).send({ userId: { not: '' } });
    expect(member.status).toBe(400);
    expect(member.body.fields).toEqual([expect.objectContaining({ field: 'userId' })]);

    const role = await request(app).patch(`/api/rooms/${room.body.id}/members/x/role`).set(auth).send({ role: 'OWNER' });
    expect(role.status).toBe(400);
    expect(role.body.fields).toEqual([expect.objectContaining({ field: 'role' })]);

    const chat = await request(app).post('/api/direct-chats').set(auth).send({ targetUserId: ['a'] });
    expect(chat.status).toBe(400);
    expect(chat.body.code).toBe('VALIDATION_ERROR');
    expect(chat.body.fields).toEqual([expect.objectContaining({ field: 'targetUserId' })]);
  });

  it('A25: a name or description of the wrong type gets 400 and the server keeps answering', async () => {
    await expectRejected({ name: { a: 1 } }, 'name');
    await expectRejected({ name: 'ok', description: 12345 }, 'description');
    await request(app).get('/health').expect(200);
  });
});
