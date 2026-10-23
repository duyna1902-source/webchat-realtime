import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createTestServer, loginAs, SessionHeaders, TestServer } from './helpers/server.js';
import { getPrisma } from '../src/lib/prisma.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { InMemoryStorageAdapter, LocalStorageAdapter } from '../src/lib/storage.js';
import { buildDocx, buildOleFile, buildPptx, buildXlsx, buildZip } from './helpers/office-fixtures.js';

let server: TestServer<InMemoryStorageAdapter>;
let authSession: SessionHeaders;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  const user = await getPrisma().user.create({
    data: { username: 'uploader', email: 'uploader@example.com', passwordHash: 'hash123' },
  });
  authSession = await loginAs(server.app, user);
});

function upload(data: Buffer, filename: string, contentType: string) {
  return request(server.app)
    .post('/api/upload')
    .set(authSession)
    .attach('file', data, { filename, contentType });
}

describe('Upload hardening: file type is detected from the content', () => {
  it('A15: an HTML page declared as application/octet-stream is rejected with 415', async () => {
    const html = Buffer.from('<script>alert(localStorage.webchat_token)</script>');

    const res = await upload(html, 'poc.html', 'application/octet-stream').expect(415);

    expect(res.body.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(res.body.message).toMatch(/not allowed|unsupported/i);
  });

  it('A16: an SVG image carrying a <script> is rejected with 415', async () => {
    const svg = Buffer.from(
      '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>'
    );

    await upload(svg, 'poc.svg', 'image/svg+xml').expect(415);
  });

  it('A17: evil.php declared as image/png is rejected with 415', async () => {
    await upload(Buffer.from('<?php system($_GET[c]); ?>'), 'evil.php', 'image/png').expect(415);
  });

  it('accepts a real PNG whatever the client declared, and stores it as image/png', async () => {
    const png = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#4285f4' } }).png().toBuffer();

    const res = await upload(png, 'diagram.bin', 'application/octet-stream').expect(201);

    expect(res.body.attachment.mimeType).toBe('image/png');
    expect(res.body.attachment.name).toBe('diagram.bin');
    const stored = server.storage.readObject(res.body.attachment.url)!;
    expect(stored.contentType).toBe('image/png');
    expect(res.body.attachment.size).toBe(stored.data.length);
    expect(await sharp(stored.data).metadata()).toMatchObject({ format: 'png', width: 3, height: 2 });
  });

  it('rejects a file that carries a PNG signature but is not a PNG image', async () => {
    const fake = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('<?php ?>')]);

    await upload(fake, 'photo.png', 'image/png').expect(415);
  });
});

describe('Upload hardening: image metadata is removed', () => {
  it('a JPEG with GPS EXIF is stored without EXIF and turned upright per its orientation', async () => {
    // 4x2 pixels, left half red and right half blue, tagged "rotate 90° clockwise" (orientation 6), with GPS.
    const left = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const jpeg = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#0000ff' } })
      .composite([{ input: left, left: 0, top: 0 }])
      .jpeg({ quality: 100 })
      .withExif({
        IFD0: { Make: 'PhoneMaker', Model: 'SecretPhone 9' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '21/1 1/1 30/1', GPSLongitudeRef: 'E', GPSLongitude: '105/1 50/1 0/1' },
      })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const before = await sharp(jpeg).metadata();
    expect(before.exif).toBeDefined();
    expect(before.orientation).toBe(6);

    const res = await upload(jpeg, 'IMG_0001.JPG', 'image/jpeg').expect(201);

    expect(res.body.attachment.mimeType).toBe('image/jpeg');
    const stored = server.storage.readObject(res.body.attachment.url)!;
    expect(res.body.attachment.size).toBe(stored.data.length);
    expect(stored.data.includes(Buffer.from('SecretPhone'))).toBe(false);
    const after = await sharp(stored.data).metadata();
    expect(after.format).toBe('jpeg');
    expect(after.exif).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    // Rotated 90° clockwise: now 2 wide and 4 tall, with the red half on top.
    expect({ width: after.width, height: after.height }).toEqual({ width: 2, height: 4 });
    const { data: pixels } = await sharp(stored.data).raw().toBuffer({ resolveWithObject: true });
    const top = [pixels[0], pixels[1], pixels[2]];
    const bottom = pixels.subarray(pixels.length - 3);
    expect(top[0]).toBeGreaterThan(200);
    expect(top[2]).toBeLessThan(60);
    expect(bottom[2]).toBeGreaterThan(200);
    expect(bottom[0]).toBeLessThan(60);
  });

  it('an animated GIF is stored byte for byte, so it stays animated', async () => {
    const red = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const blue = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#0000ff' } }).png().toBuffer();
    const gif = await sharp([red, blue], { join: { animated: true } }).gif().toBuffer();

    const res = await upload(gif, 'party.gif', 'application/octet-stream').expect(201);

    expect(res.body.attachment.mimeType).toBe('image/gif');
    expect(res.body.attachment.size).toBe(gif.length);
    expect(server.storage.read(res.body.attachment.url)!.equals(gif)).toBe(true);
  });
});

describe('Upload hardening: documents', () => {
  it('accepts a PDF and stores it as application/pdf', async () => {
    const res = await upload(Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n'), 'report.pdf', 'text/html').expect(201);

    expect(res.body.attachment.mimeType).toBe('application/pdf');
  });

  it.each([
    ['report.docx', buildDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['budget.xlsx', buildXlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['slides.pptx', buildPptx, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ])('accepts a valid %s as its OOXML type', async (filename, build, mimeType) => {
    const res = await upload(build(), filename, 'application/octet-stream').expect(201);

    expect(res.body.attachment.mimeType).toBe(mimeType);
  });

  it('rejects a plain ZIP renamed to .docx with 415', async () => {
    const zip = buildZip({ 'payload.exe': Buffer.from([0x4d, 0x5a, 0x00]), 'readme.txt': 'hi' });

    await upload(zip, 'report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').expect(
      415
    );
  });

  it('rejects a macro-enabled Word document disguised as .docx with 415', async () => {
    const docm = buildZip({
      '[Content_Types].xml': '<Types/>',
      'word/document.xml': '<w:document/>',
      'word/vbaProject.bin': Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
    });

    await upload(docm, 'invoice.docx', 'application/octet-stream').expect(415);
  });

  it.each([
    ['memo.doc', 'WordDocument', 'application/msword'],
    ['sheet.xls', 'Workbook', 'application/vnd.ms-excel'],
    ['deck.ppt', 'PowerPoint Document', 'application/vnd.ms-powerpoint'],
  ])('accepts a legacy %s as its Office type', async (filename, stream, mimeType) => {
    const res = await upload(buildOleFile(stream), filename, 'application/octet-stream').expect(201);

    expect(res.body.attachment.mimeType).toBe(mimeType);
  });

  it('rejects another kind of OLE file (e.g. an installer package) with 415', async () => {
    await upload(buildOleFile('SummaryInformation'), 'setup.doc', 'application/msword').expect(415);
  });

  it.each([
    ['notes.txt', 'text/plain', 'Meeting at 10:00\n'],
    ['grades.csv', 'text/csv', 'name,score\nalice,10\n'],
    ['README.md', 'text/markdown', '# Title\n\n<script>alert(1)</script> is shown as text\n'],
    ['data.json', 'application/json', '{"ok": true, "emoji": "Xin chào 👋"}'],
  ])('stores %s as plain UTF-8 text', async (filename, declared, content) => {
    const res = await upload(Buffer.from(content), filename, declared).expect(201);

    expect(res.body.attachment.mimeType).toBe('text/plain; charset=utf-8');
    expect(server.storage.readObject(res.body.attachment.url)!.contentType).toBe('text/plain; charset=utf-8');
  });

  it.each([
    ['a Windows executable', 'setup.txt', Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])],
    ['an ELF executable', 'run.txt', Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00])],
    ['a shell script', 'install.txt', Buffer.from('#!/bin/sh\nrm -rf ~\n')],
    ['an RTF document', 'letter.txt', Buffer.from('{\\rtf1\\ansi Hello}')],
    ['text that is not valid UTF-8', 'legacy.txt', Buffer.from([0x48, 0x69, 0xff, 0xfe, 0x21])],
  ])('rejects %s with 415', async (_label, filename, data) => {
    await upload(data, filename, 'text/plain').expect(415);
  });

  it('rejects a truncated ZIP or OLE container with 415, not a server error', async () => {
    await upload(buildDocx().subarray(0, 40), 'cut.docx', 'application/octet-stream').expect(415);
    await upload(buildOleFile('WordDocument').subarray(0, 700), 'cut.doc', 'application/msword').expect(415);
  });
});

describe('Upload hardening: local storage adapter (dev and test only)', () => {
  let local: TestServer<LocalStorageAdapter>;
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-uploads-'));
    local = await createTestServer({ storage: new LocalStorageAdapter(dir) });
  });

  afterAll(async () => {
    await local.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function uploadLocal(data: Buffer, filename: string, contentType: string) {
    return request(local.app)
      .post('/api/upload')
      .set(authSession)
      .attach('file', data, { filename, contentType });
  }

  it.each([
    ['grades.csv', 'text/csv', 'name,score\nalice,10\n'],
    ['README.md', 'text/markdown', '# Notes\n\n<img src=x onerror=alert(1)>\n'],
  ])('serves %s as a plain-text download with nosniff', async (filename, declared, content) => {
    const res = await uploadLocal(Buffer.from(content), filename, declared).expect(201);

    const served = await request(local.app).get(res.body.attachment.url).expect(200);
    expect(served.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(served.headers['content-disposition']).toBe('attachment');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.text).toBe(content);
  });

  it('names the stored object with a random key that does not contain the original file name', async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#34a853' } }).png().toBuffer();

    const res = await uploadLocal(png, 'my-secret-holiday.png', 'image/png').expect(201);

    expect(res.body.attachment.url).not.toMatch(/holiday/);
    expect(res.body.attachment.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\?expires=\d+&signature=[\w-]+$/);
    expect(fs.readdirSync(dir).some((name) => name.includes('holiday'))).toBe(false);
    const served = await request(local.app).get(res.body.attachment.url).expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['content-disposition']).toBe('attachment');
  });

  it('answers 404 for an unknown or malformed object key', async () => {
    await request(local.app).get('/uploads/00000000-0000-4000-8000-000000000000').expect(404);
    await request(local.app).get('/uploads/..%2F..%2Fpackage.json').expect(404);
  });
});
