import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import type { Express } from 'express';
import { createTestServer, loginAs, SessionHeaders, TEST_APP_ORIGIN } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import {
  LocalStorageAdapter,
  SupabaseStorageAdapter,
  createStorageAdapter,
} from '../src/lib/storage.js';

let app: Express;
let uploadsDir: string;
/** Clock of the local adapter, so a test can move past a signed URL's expiry. */
let now = Date.now();

beforeAll(async () => {
  // Local disk storage in a temp dir, so uploaded files can be fetched back through /uploads.
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-upload-test-'));
  ({ app } = await createTestServer({ storage: new LocalStorageAdapter({ dir: uploadsDir, now: () => now }) }));
});

afterAll(() => {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

function pngImage(): Promise<Buffer> {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: '#ea4335' } }).png().toBuffer();
}

describe('File Upload REST API (POST /api/upload)', () => {
  let authSession: SessionHeaders;
  let testUser: any;

  // Per test: the database is reset before each one, and an Attachment needs its uploader.
  beforeEach(async () => {
    const prisma = getPrisma();
    testUser = await prisma.user.create({
      data: {
        username: 'uploaduser',
        email: 'uploaduser@example.com',
        passwordHash: 'hash123',
      },
    });
    authSession = await loginAs(app, testUser);
  });

  it('rejects upload when unauthenticated with 401', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Origin', TEST_APP_ORIGIN)
      .attach('file', Buffer.from('dummy file content'), 'test.txt')
      .expect(401);

    expect(res.body.message).toMatch(/authentication required/i);
  });

  it('rejects upload when no file is attached with 400', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set(authSession)
      .expect(400);

    expect(res.body.message).toMatch(/no file/i);
  });

  it('successfully uploads a valid image file and returns metadata', async () => {
    const imageBuffer = await pngImage();

    const res = await request(app)
      .post('/api/upload')
      .set(authSession)
      .attach('file', imageBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    const { attachment } = res.body;
    expect(attachment).toHaveProperty('url');
    expect(attachment).toHaveProperty('size');
    expect(attachment).toHaveProperty('mimeType', 'image/png');
    expect(attachment.name).toBe('avatar.png');

    // The file can be retrieved via the signed URL, with the size the server reported.
    const getRes = await request(app).get(attachment.url).buffer(true).expect(200);
    expect(getRes.headers['content-type']).toBe('image/png');
    expect(Number(getRes.headers['content-length'])).toBe(attachment.size);
  });

  describe('local storage signed URLs (HMAC with expiry)', () => {
    async function uploadPdf(): Promise<string> {
      const res = await request(app)
        .post('/api/upload')
        .set(authSession)
        .attach('file', Buffer.from('%PDF-1.4 signed'), { filename: 'signed.pdf', contentType: 'application/pdf' })
        .expect(201);
      return res.body.attachment.url;
    }

    it('serves the file only with a valid signature', async () => {
      const url = await uploadPdf();
      const unsigned = url.split('?')[0];
      const tampered = url.replace(/signature=[^&]+/, 'signature=AAAA');
      const otherExpiry = url.replace(/expires=(\d+)/, (_m, ms) => `expires=${Number(ms) + 1000}`);

      await request(app).get(url).expect(200);
      for (const forged of [unsigned, tampered, otherExpiry]) {
        await request(app).get(forged).expect(404);
      }
    });

    it('stops serving the file once the signed URL expired', async () => {
      const url = await uploadPdf();

      now += 3601 * 1000;

      await request(app).get(url).expect(404);
    });
  });

  it('successfully uploads a valid document file (PDF)', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf data');

    const res = await request(app)
      .post('/api/upload')
      .set(authSession)
      .attach('file', pdfBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(res.body.attachment).toHaveProperty('url');
    expect(res.body.attachment.mimeType).toBe('application/pdf');
    expect(res.body.attachment.size).toBe(pdfBuffer.length);
    expect(res.body.attachment.name).toBe('document.pdf');
  });

  it('rejects files exceeding 10MB limit with 413', async () => {
    // 10MB + 1KB buffer
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);

    const res = await request(app)
      .post('/api/upload')
      .set(authSession)
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
      .set(authSession)
      .attach('file', exeBuffer, {
        filename: 'malicious.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(415);

    expect(res.body.message).toMatch(/not allowed/i);
  });

  describe('Supabase storage adapter behind the server factory', () => {
    it('uploads to the private bucket with only the secret key in the apikey header, then signs a URL', async () => {
      const requests: { url: string; headers: Headers; body: unknown }[] = [];
      const fakeFetch: typeof fetch = async (input, init) => {
        const url = String(input);
        requests.push({ url, headers: new Headers(init?.headers), body: init?.body });
        if (url.includes('/object/sign/')) {
          const key = url.split('/').pop();
          return Response.json({ signedURL: `/object/sign/attachments/${key}?token=signed-token` });
        }
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
          .set(authSession)
          .attach('file', await pngImage(), { filename: 'photo.png', contentType: 'application/octet-stream' })
          .expect(201);

        expect(requests).toHaveLength(2);
        const [put, sign] = requests;
        expect(put.url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/attachments\/[0-9a-f-]{36}$/);
        expect(put.headers.get('apikey')).toBe('sb_secret_test_only');
        expect(put.headers.has('authorization')).toBe(false);
        // Stored with the detected type, not the one the client declared.
        expect(put.headers.get('content-type')).toBe('image/png');

        const key = put.url.split('/').pop();
        expect(sign.url).toBe(`https://project.supabase.co/storage/v1/object/sign/attachments/${key}`);
        expect(sign.headers.get('apikey')).toBe('sb_secret_test_only');
        expect(sign.headers.has('authorization')).toBe(false);
        expect(JSON.parse(String(sign.body))).toEqual({ expiresIn: 3600 });
        // Never a public object URL: only the signed one.
        expect(res.body.attachment.url).toBe(
          `https://project.supabase.co/storage/v1/object/sign/attachments/${key}?token=signed-token`
        );
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

    describe('SupabaseStorageAdapter signing, delete and list', () => {
      function adapterWith(handler: (url: string, init: RequestInit) => Response) {
        const calls: { url: string; method?: string; body: any; headers: Headers }[] = [];
        const adapter = new SupabaseStorageAdapter({
          url: 'https://fake.supabase.co/',
          secretKey: 'sb_secret_x',
          bucket: 'attachments',
          now: () => Date.UTC(2026, 0, 1),
          fetch: async (input, init = {}) => {
            calls.push({
              url: String(input),
              method: init.method,
              body: init.body ? JSON.parse(String(init.body)) : undefined,
              headers: new Headers(init.headers),
            });
            return handler(String(input), init);
          },
        });
        return { adapter, calls };
      }

      it('signs many keys in one call, leaving out the ones Supabase could not sign', async () => {
        const { adapter, calls } = adapterWith(() =>
          Response.json([
            { path: 'k1', signedURL: '/object/sign/attachments/k1?token=t1', error: null },
            { path: 'k2', signedURL: null, error: 'Either the object does not exist or you do not have access to it' },
          ])
        );

        const signed = await adapter.createSignedUrls(['k1', 'k2', 'k1'], 120);

        expect(calls).toEqual([
          expect.objectContaining({
            url: 'https://fake.supabase.co/storage/v1/object/sign/attachments',
            method: 'POST',
            body: { expiresIn: 120, paths: ['k1', 'k2'] },
          }),
        ]);
        expect([...signed.keys()]).toEqual(['k1']);
        expect(signed.get('k1')).toEqual({
          url: 'https://fake.supabase.co/storage/v1/object/sign/attachments/k1?token=t1',
          expiresAt: new Date(Date.UTC(2026, 0, 1) + 120_000),
        });
      });

      it('deletes an object and lists every object key page by page', async () => {
        const firstPage = Array.from({ length: 1000 }, (_, i) => ({ name: `key-${i}`, id: `id-${i}` }));
        const { adapter, calls } = adapterWith((url, init) => {
          if (init.method === 'DELETE') return Response.json([]);
          const { offset } = JSON.parse(String(init.body));
          return Response.json(offset === 0 ? firstPage : [{ name: 'last', id: 'id-last' }, { name: 'folder', id: null }]);
        });

        await adapter.delete('k1');
        const keys = await adapter.list();

        expect(calls[0]).toMatchObject({
          url: 'https://fake.supabase.co/storage/v1/object/attachments',
          method: 'DELETE',
          body: { prefixes: ['k1'] },
        });
        expect(calls.slice(1).map((c) => [c.url, c.body.offset])).toEqual([
          ['https://fake.supabase.co/storage/v1/object/list/attachments', 0],
          ['https://fake.supabase.co/storage/v1/object/list/attachments', 1000],
        ]);
        expect(calls.every((c) => c.headers.get('apikey') === 'sb_secret_x' && !c.headers.has('authorization'))).toBe(true);
        expect(keys).toHaveLength(1001);
        expect(keys.at(-1)).toBe('last');
      });
    });
  });
});
