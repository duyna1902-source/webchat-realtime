import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestServer, sessionCookieOf, TEST_APP_ORIGIN } from './helpers/server.js';

let app: Express;

beforeAll(async () => {
  // One server for the whole file registers far more than 5 users from one IP; the register
  // limit itself is covered in rate-limit.test.ts.
  ({ app } = await createTestServer({ config: { rateLimits: { register: { max: 1000, windowMs: 60_000 } } } }));
});

describe('Auth REST API Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user and returns the user (the Session goes in the cookie)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(201);

      expect(res.body).not.toHaveProperty('token');
      expect(sessionCookieOf(res)).toMatch(/^__Host-session=.+/);
      expect(res.body.user).toMatchObject({
        username: 'alice',
        email: 'alice@example.com',
        isOnline: false,
      });
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects registration when username already exists', async () => {
      await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'alice',
          email: 'alice_different@example.com',
          password: 'Password123!',
        })
        .expect(400);

      expect(res.body.message).toMatch(/username already taken/i);
    });

    it('rejects registration when email already exists', async () => {
      await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'bob',
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(400);

      expect(res.body.message).toMatch(/email already registered/i);
    });

    it('rejects registration with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'alice',
        })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.fields.map((f: { field: string }) => f.field).sort()).toEqual(['email', 'password']);
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates user with username and password', async () => {
      await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'bob',
          email: 'bob@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          emailOrUsername: 'bob',
          password: 'Password123!',
        })
        .expect(200);

      expect(res.body).not.toHaveProperty('token');
      expect(sessionCookieOf(res)).toMatch(/^__Host-session=.+/);
      expect(res.body.user).toMatchObject({
        username: 'bob',
        email: 'bob@example.com',
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('authenticates user with email and password', async () => {
      await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'charlie',
          email: 'charlie@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          emailOrUsername: 'charlie@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(res.body).not.toHaveProperty('token');
      expect(sessionCookieOf(res)).toMatch(/^__Host-session=.+/);
      expect(res.body.user.username).toBe('charlie');
    });

    it('rejects login with incorrect password', async () => {
      await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'david',
          email: 'david@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          emailOrUsername: 'david',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(res.body.message).toMatch(/invalid credentials/i);
    });

    it('rejects login for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          emailOrUsername: 'nonexistent',
          password: 'Password123!',
        })
        .expect(401);

      expect(res.body.message).toMatch(/invalid credentials/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user profile when a valid Session cookie is supplied', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .set('Origin', TEST_APP_ORIGIN)
        .send({
          username: 'eve',
          email: 'eve@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookieOf(regRes))
        .expect(200);

      expect(res.body.user).toMatchObject({
        username: 'eve',
        email: 'eve@example.com',
        isOnline: false,
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 when the Session cookie is missing', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.message).toMatch(/authentication required/i);
    });

    it('returns 401 when the Session cookie is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', '__Host-session=invalid-token-string')
        .expect(401);

      expect(res.body.message).toMatch(/authentication required/i);
    });
  });
});
