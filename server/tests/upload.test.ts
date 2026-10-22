import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import type { Express } from 'express';
import { createTestServer, generateToken } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import {
  LocalStorageAdapter,
  SupabaseStorageAdapter,
  createStorageAdapter,
} from '../src/lib/storage.js';

let app: Express;
let uploadsDir: string;

beforeAll(async () => {
  // Local disk storage in a temp dir, so uploaded files can be fetched back through /uploads.
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-upload-test-'));
  ({ app } = await createTestServer({ storage: new LocalStorageAdapter(uploadsDir) }));
});

afterAll(() => {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

function pngImage(): Promise<Buffer> {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: '#ea4335' } }).png().toBuffer();
}

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
    const imageBuffer = await pngImage();

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
    expect(res.body.name).toBe('avatar.png');

    // The file can be retrieved via the returned URL, with the size the server reported.
    const getRes = await request(app).get(res.body.url).buffer(true).expect(200);
    expect(getRes.headers['content-type']).toBe('image/png');
    expect(Number(getRes.headers['content-length'])).toBe(res.body.size);
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
    expect(res.body.name).toBe('document.pdf');
  });

  it('rejects files exceeding 10MB limit with 413', async () => {
    // 10MB + 1KB buffer
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', largeBuffer, {
        filename: 'large-file.zip',
        contentType: 'application/zip',
      })
      .expect(413);

    expect(res.body.message).toMatch(/limit|large|10MB|size/i);
  });

  it('rejects disallowed file types with 415', async () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]);

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', exeBuffer, {
        filename: 'malicious.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(415);

    expect(res.body.message).toMatch(/not allowed/i);
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
          .attach('file', await pngImage(), { filename: 'photo.png', contentType: 'application/octet-stream' })
          .expect(200);

        expect(res.body.url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/attachments\//);
        expect(requests).toHaveLength(1);
        expect(requests[0].url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/attachments\/[0-9a-f-]{36}$/);
        expect(requests[0].headers.get('apikey')).toBe('sb_secret_test_only');
        expect(requests[0].headers.has('authorization')).toBe(false);
        // Stored with the detected type, not the one the client declared.
        expect(requests[0].headers.get('content-type')).toBe('image/png');
      } finally {
        await supabase.close();
      }
    });
  });

  describe('Cloud Storage Adapter Architecture (ADR 0004)', () => {
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

    it('SupabaseStorageAdapter reports a failed upload as an error', async () => {
      const fakeFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('Bucket not found', { status: 400 }));
      const adapter = new SupabaseStorageAdapter({
        url: 'https://fake.supabase.co',
        secretKey: 'secret-key',
        bucket: 'attachments',
        fetch: fakeFetch,
      });

      await expect(adapter.put(Buffer.from('%PDF-1.4'), { contentType: 'application/pdf' })).rejects.toThrow();
    });
  });
});
