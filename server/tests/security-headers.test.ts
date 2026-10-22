import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTestServer, TestServer } from './helpers/server.js';

const SUPABASE_ORIGIN = 'https://abcdefgh.supabase.co';

// The policy from the spec (SEC-12), written out by hand so the test is an independent source of truth.
const EXPECTED_CSP: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'blob:', SUPABASE_ORIGIN, 'https://*.giphy.com'],
  'connect-src': ["'self'", SUPABASE_ORIGIN],
  'frame-src': [SUPABASE_ORIGIN],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

function parseCsp(header: string | undefined): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  for (const part of (header ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives[name] = sources;
  }
  return directives;
}

/** A minimal client build: the SPA shell plus one static asset. */
function createClientDist(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-headers-dist-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>spa-shell</title>');
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log("app");');
  return dir;
}

describe('Security headers (A01)', () => {
  let server: TestServer;
  let clientDist: string;

  beforeAll(async () => {
    clientDist = createClientDist();
    server = await createTestServer({
      config: {
        clientDistPath: clientDist,
        // Trailing path on purpose: only the origin may end up in the policy.
        storage: { provider: 'supabase', url: `${SUPABASE_ORIGIN}/`, secretKey: 'test-secret', bucket: 'attachments' },
      },
    });
  });

  afterAll(async () => {
    await server.close();
    fs.rmSync(clientDist, { recursive: true, force: true });
  });

  it.each([
    ['the SPA shell', '/'],
    ['an SPA route', '/rooms/some-room'],
    ['an API response', '/api/auth/me'],
    ['the health check', '/health'],
    ['a static asset of the client build', '/assets/app.js'],
  ])('sends the full security header set on %s (%s)', async (_label, url) => {
    const res = await request(server.app).get(url);

    expect(parseCsp(res.headers['content-security-policy'])).toEqual(EXPECTED_CSP);
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('0');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('SPA fallback', () => {
  let server: TestServer;
  let clientDist: string;

  beforeAll(async () => {
    clientDist = createClientDist();
    server = await createTestServer({ config: { clientDistPath: clientDist } });
  });

  afterAll(async () => {
    await server.close();
    fs.rmSync(clientDist, { recursive: true, force: true });
  });

  it.each(['/', '/rooms/some-room', '/apiary', '/healthy', '/uploads-help'])('serves the SPA shell for GET %s', async (url) => {
    const res = await request(server.app).get(url).expect(200);

    expect(res.text).toContain('spa-shell');
  });

  it.each(['/api', '/api/unknown', '/health/ready', '/uploads/missing.png', '/socket.io/anything'])(
    'does not serve the SPA shell for GET %s',
    async (url) => {
      const res = await request(server.app).get(url);

      expect(res.status).toBe(404);
      expect(res.text).not.toContain('spa-shell');
    }
  );

  it('does not serve the SPA shell for non-GET requests', async () => {
    const res = await request(server.app).post('/rooms/some-room');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('spa-shell');
  });
});

describe('No CORS on the single-host app (A23)', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer({ listen: true });
  });

  afterAll(async () => {
    await server.close();
  });

  it('does not allow a cross-site preflight on the REST API', async () => {
    const res = await request(server.app)
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not allow a cross-site request on the REST API', async () => {
    const res = await request(server.app).get('/health').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not allow a cross-site Socket.IO polling handshake', async () => {
    const url = `http://localhost:${server.port}/socket.io/?EIO=4&transport=polling`;
    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' },
    });
    const handshake = await fetch(url, { headers: { Origin: 'https://evil.example' } });

    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    expect(handshake.headers.get('access-control-allow-origin')).toBeNull();
  });
});
