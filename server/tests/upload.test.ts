import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
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

    it('CloudinaryStorageAdapter unlinks ephemeral local file on success and failure', async () => {
      const { CloudinaryStorageAdapter } = await import('../src/lib/storage.js');
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      const adapter = new CloudinaryStorageAdapter();

      // Create a temp file on disk
      const tmpFilePath = path.join(os.tmpdir(), `test-cloudinary-${Date.now()}.png`);
      fs.writeFileSync(tmpFilePath, 'fake image data');
      expect(fs.existsSync(tmpFilePath)).toBe(true);

      const mockFile: any = {
        path: tmpFilePath,
        originalname: 'test.png',
        filename: 'test.png',
        size: 15,
        mimetype: 'image/png',
      };

      // Mock successful fetch
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          secure_url: 'https://cloudinary.com/fake.png',
          public_id: 'fake_id',
          bytes: 15,
        }),
      } as any);

      const result = await adapter.upload(mockFile);
      expect(result.url).toBe('https://cloudinary.com/fake.png');
      expect(fs.existsSync(tmpFilePath)).toBe(false);

      // Verify unlinks on failure
      const tmpFailPath = path.join(os.tmpdir(), `test-cloudinary-fail-${Date.now()}.png`);
      fs.writeFileSync(tmpFailPath, 'fake error data');
      expect(fs.existsSync(tmpFailPath)).toBe(true);

      const mockFailFile: any = {
        path: tmpFailPath,
        originalname: 'fail.png',
        filename: 'fail.png',
        size: 15,
        mimetype: 'image/png',
      };

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid credentials',
      } as any);

      await expect(adapter.upload(mockFailFile)).rejects.toThrow();
      expect(fs.existsSync(tmpFailPath)).toBe(false);

      fetchSpy.mockRestore();
    });

    it('SupabaseStorageAdapter unlinks ephemeral local file on success and failure', async () => {
      const { SupabaseStorageAdapter } = await import('../src/lib/storage.js');
      process.env.SUPABASE_URL = 'https://fake.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-key';
      const adapter = new SupabaseStorageAdapter();

      const tmpFilePath = path.join(os.tmpdir(), `test-supabase-${Date.now()}.pdf`);
      fs.writeFileSync(tmpFilePath, 'fake pdf data');
      expect(fs.existsSync(tmpFilePath)).toBe(true);

      const mockFile: any = {
        path: tmpFilePath,
        originalname: 'test.pdf',
        filename: 'test.pdf',
        size: 13,
        mimetype: 'application/pdf',
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
      } as any);

      const result = await adapter.upload(mockFile);
      expect(result.url).toContain('https://fake.supabase.co/storage/v1/object/public/attachments/');
      expect(fs.existsSync(tmpFilePath)).toBe(false);

      // Verify unlinks on failure
      const tmpFailPath = path.join(os.tmpdir(), `test-supabase-fail-${Date.now()}.pdf`);
      fs.writeFileSync(tmpFailPath, 'fake error pdf');
      expect(fs.existsSync(tmpFailPath)).toBe(true);

      const mockFailFile: any = {
        path: tmpFailPath,
        originalname: 'fail.pdf',
        filename: 'fail.pdf',
        size: 14,
        mimetype: 'application/pdf',
      };

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Bucket not found',
      } as any);

      await expect(adapter.upload(mockFailFile)).rejects.toThrow();
      expect(fs.existsSync(tmpFailPath)).toBe(false);

      fetchSpy.mockRestore();
    });

    it('LocalStorageAdapter retains local file on disk', async () => {
      const { LocalStorageAdapter } = await import('../src/lib/storage.js');
      const adapter = new LocalStorageAdapter();

      const tmpFilePath = path.join(os.tmpdir(), `test-local-${Date.now()}.txt`);
      fs.writeFileSync(tmpFilePath, 'local data');
      expect(fs.existsSync(tmpFilePath)).toBe(true);

      const mockFile: any = {
        path: tmpFilePath,
        originalname: 'local.txt',
        filename: 'local.txt',
        size: 10,
        mimetype: 'text/plain',
      };

      await adapter.upload(mockFile);
      // Local storage adapter must retain the file
      expect(fs.existsSync(tmpFilePath)).toBe(true);
      fs.unlinkSync(tmpFilePath);
    });
  });
});
