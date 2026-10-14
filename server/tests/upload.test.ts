import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { getPrisma } from '../src/lib/prisma.js';
import { generateToken } from '../src/lib/jwt.js';

describe('File Upload REST API (POST /api/upload)', () => {
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    const prisma = getPrisma();
    testUser = await prisma.user.create({
      data: {
        username: 'uploaduser',
        email: 'uploaduser@example.com',
        passwordHash: 'hash123',
      },
    });
    authToken = generateToken({ userId: testUser.id, username: testUser.username });
  });

  it('rejects upload when unauthenticated with 401', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('dummy file content'), 'test.txt')
      .expect(401);

    expect(res.body.message).toMatch(/authorization required|token/i);
  });

  it('rejects upload when no file is attached with 400', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.message).toMatch(/no file/i);
  });

  it('successfully uploads a valid image file and returns metadata', async () => {
    const imageBuffer = Buffer.from('fake-png-binary-data');

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', imageBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(res.body).toHaveProperty('url');
    expect(res.body).toHaveProperty('size');
    expect(res.body).toHaveProperty('mimeType', 'image/png');
    expect(res.body.size).toBe(imageBuffer.length);
    expect(res.body.filename || res.body.name).toBe('avatar.png');

    // Verify file can be retrieved via the returned URL
    const getRes = await request(app).get(res.body.url).expect(200);
    expect(getRes.body).toBeDefined();
  });

  it('successfully uploads a valid document file (PDF)', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf data');

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', pdfBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    expect(res.body).toHaveProperty('url');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.size).toBe(pdfBuffer.length);
    expect(res.body.filename || res.body.name).toBe('document.pdf');
  });

  it('rejects files exceeding 10MB limit with 400 or 413', async () => {
    // 10MB + 1KB buffer
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', largeBuffer, {
        filename: 'large-file.zip',
        contentType: 'application/zip',
      });

    expect([400, 413]).toContain(res.status);
    expect(res.body.message).toMatch(/limit|large|10MB|size/i);
  });

  it('rejects disallowed file types with 400', async () => {
    const exeBuffer = Buffer.from('MZ fake exe data');

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', exeBuffer, {
        filename: 'malicious.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);

    expect(res.body.message).toMatch(/unsupported|invalid|disallowed|mime/i);
  });

  describe('Cloud Storage Adapter Architecture (ADR 0004)', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('uses LocalStorageAdapter and respects PUBLIC_URL for full public URLs', async () => {
      const { LocalStorageAdapter } = await import('../src/lib/storage.js');
      const adapter = new LocalStorageAdapter();
      expect(adapter.name).toBe('local');

      process.env.PUBLIC_URL = 'https://chat.example.com';
      const mockFile: any = {
        originalname: 'sample.png',
        filename: '123-sample.png',
        size: 1024,
        mimetype: 'image/png',
      };

      const result = await adapter.upload(mockFile);
      expect(result.url).toBe('https://chat.example.com/uploads/123-sample.png');
      expect(result.name).toBe('sample.png');
      expect(result.size).toBe(1024);
    });

    it('resolves correct adapter from environment configuration in getStorageAdapter', async () => {
      const { getStorageAdapter } = await import('../src/lib/storage.js');

      // Default should be local
      delete process.env.STORAGE_PROVIDER;
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.SUPABASE_URL;
      const defaultAdapter = getStorageAdapter();
      expect(defaultAdapter.name).toBe('local');

      // Cloudinary configuration
      process.env.STORAGE_PROVIDER = 'cloudinary';
      process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
      const cloudinaryAdapter = getStorageAdapter();
      expect(cloudinaryAdapter.name).toBe('cloudinary');

      // Supabase configuration
      process.env.STORAGE_PROVIDER = 'supabase';
      process.env.SUPABASE_URL = 'https://demo.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-service-key';
      const supabaseAdapter = getStorageAdapter();
      expect(supabaseAdapter.name).toBe('supabase');
    });
  });
});
