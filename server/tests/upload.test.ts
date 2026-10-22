import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Express } from 'express';
import { createTestServer, generateToken } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import {
  LocalStorageAdapter,
  SupabaseStorageAdapter,
  createStorageAdapter,
} from '../src/lib/storage.js';

let app: Express;

beforeAll(async () => {
  // Local disk storage, so uploaded files can be fetched back through /uploads.
  ({ app } = await createTestServer({ storage: new LocalStorageAdapter() }));
});

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

  describe('Supabase storage adapter behind the server factory', () => {
    it('sends the upload to Supabase with only the secret key in the apikey header', async () => {
      const requests: { url: string; headers: Headers }[] = [];
      const fakeFetch: typeof fetch = async (input, init) => {
        requests.push({ url: String(input), headers: new Headers(init?.headers) });
        return new Response('{}', { status: 200 });
      };
      const supabase = await createTestServer({
        storage: new SupabaseStorageAdapter({
          url: 'https://project.supabase.co',
          secretKey: 'sb_secret_test_only',
          bucket: 'attachments',
          fetch: fakeFetch,
        }),
      });

      try {
        const res = await request(supabase.app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from('fake-png-binary-data'), { filename: 'photo.png', contentType: 'image/png' })
          .expect(200);

        expect(res.body.url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/attachments\//);
        expect(requests).toHaveLength(1);
        expect(requests[0].url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/attachments\//);
        expect(requests[0].headers.get('apikey')).toBe('sb_secret_test_only');
        expect(requests[0].headers.has('authorization')).toBe(false);
      } finally {
        await supabase.close();
      }
    });
  });

  describe('Cloud Storage Adapter Architecture (ADR 0004)', () => {
    it('uses LocalStorageAdapter with same-origin relative URLs', async () => {
      const adapter = new LocalStorageAdapter();
      expect(adapter.name).toBe('local');

      const mockFile: any = {
        originalname: 'sample.png',
        filename: '123-sample.png',
        size: 1024,
        mimetype: 'image/png',
      };

      const result = await adapter.upload(mockFile);
      expect(result.url).toBe('/uploads/123-sample.png');
      expect(result.name).toBe('sample.png');
      expect(result.size).toBe(1024);
    });

    it('builds the adapter selected by the storage configuration in createStorageAdapter', () => {
      expect(createStorageAdapter({ provider: 'local' }).name).toBe('local');
      expect(
        createStorageAdapter({
          provider: 'supabase',
          url: 'https://demo.supabase.co',
          secretKey: 'secret-key',
          bucket: 'attachments',
        }).name
      ).toBe('supabase');
    });

    it('SupabaseStorageAdapter unlinks ephemeral local file on success and failure', async () => {
      const fakeFetch = vi.fn<typeof fetch>();
      const adapter = new SupabaseStorageAdapter({
        url: 'https://fake.supabase.co',
        secretKey: 'secret-key',
        bucket: 'attachments',
        fetch: fakeFetch,
      });

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

      fakeFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

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

      fakeFetch.mockResolvedValueOnce(new Response('Bucket not found', { status: 400 }));

      await expect(adapter.upload(mockFailFile)).rejects.toThrow();
      expect(fs.existsSync(tmpFailPath)).toBe(false);
    });

    it('LocalStorageAdapter retains local file on disk', async () => {
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
