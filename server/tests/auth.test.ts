import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Auth REST API Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user and returns JWT token and user info', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
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
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/register')
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
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/register')
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
        .send({
          username: 'alice',
        })
        .expect(400);

      expect(res.body.message).toMatch(/all fields are required/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates user with username and password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'bob',
          email: 'bob@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'bob',
          password: 'Password123!',
        })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toMatchObject({
        username: 'bob',
        email: 'bob@example.com',
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('authenticates user with email and password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'charlie',
          email: 'charlie@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'charlie@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body.user.username).toBe('charlie');
    });

    it('rejects login with incorrect password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'david',
          email: 'david@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/login')
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
        .send({
          emailOrUsername: 'nonexistent',
          password: 'Password123!',
        })
        .expect(401);

      expect(res.body.message).toMatch(/invalid credentials/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user profile when valid token is supplied', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'eve',
          email: 'eve@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const token = regRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        username: 'eve',
        email: 'eve@example.com',
        isOnline: false,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.message).toMatch(/authorization required/i);
    });

    it('returns 401 when Authorization token is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string')
        .expect(401);

      expect(res.body.message).toMatch(/invalid or expired token/i);
    });
  });
});
