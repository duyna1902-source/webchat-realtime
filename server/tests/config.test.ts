import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, ConfigError } from '../src/config.js';

const SECRET_32 = 'a-development-secret-that-is-32-bytes-or-more';

const devEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/webchat',
  APP_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: SECRET_32,
};

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/webchat',
  APP_ORIGIN: 'https://webchat-realtime.onrender.com',
  JWT_SECRET: SECRET_32,
  STORAGE_PROVIDER: 'supabase',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_example',
  SUPABASE_STORAGE_BUCKET: 'attachments',
};

function configErrorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ConfigError) return err;
    throw err;
  }
  throw new Error('Expected loadConfig to throw a ConfigError');
}

describe('loadConfig', () => {
  let clientDist: string;
  const missingClientDist = path.join(os.tmpdir(), 'webchat-no-client-build-here');

  beforeAll(() => {
    clientDist = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-client-dist-'));
    fs.writeFileSync(path.join(clientDist, 'index.html'), '<!doctype html>');
  });

  afterAll(() => {
    fs.rmSync(clientDist, { recursive: true, force: true });
  });

  it('returns a typed config built only from the given environment object', () => {
    const config = loadConfig({ ...devEnv, PORT: '4100', GIPHY_API_KEY: 'giphy-key', LOG_LEVEL: 'debug' }, { clientDistPath: missingClientDist });

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(4100);
    expect(config.appOrigin).toBe('http://localhost:5173');
    expect(config.databaseUrl).toBe(devEnv.DATABASE_URL);
    expect(config.jwtSecret).toBe(SECRET_32);
    expect(config.giphyApiKey).toBe('giphy-key');
    expect(config.logLevel).toBe('debug');
    expect(config.storage).toEqual({ provider: 'local' });
    expect(config.clientDistPath).toBeNull();
  });

  it('uses spec defaults for optional settings, rate limits and timings', () => {
    const config = loadConfig(devEnv, { clientDistPath: missingClientDist });

    expect(config.port).toBe(4000);
    expect(config.logLevel).toBe('info');
    expect(config.giphyApiKey).toBeNull();
    expect(config.timing.presenceGracePeriodMs).toBe(5000);
    expect(config.timing.connectionStateRecoveryMs).toBe(2 * 60 * 1000);
    expect(config.timing.signedUrlTtlSeconds).toBe(3600);
    expect(config.timing.sessionIdleTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(config.timing.sessionAbsoluteTtlMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(config.rateLimits.loginFailures).toEqual({ max: 10, windowMs: 15 * 60 * 1000 });
    expect(config.rateLimits.register).toEqual({ max: 5, windowMs: 60 * 60 * 1000 });
    expect(config.rateLimits.upload).toEqual({ max: 20, windowMs: 10 * 60 * 1000 });
    expect(config.rateLimits.userSearch).toEqual({ max: 30, windowMs: 60 * 1000 });
    expect(config.rateLimits.gifs).toEqual({ max: 30, windowMs: 60 * 1000 });
    expect(config.rateLimits.roomCreate).toEqual({ max: 10, windowMs: 60 * 60 * 1000 });
    expect(config.rateLimits.messageSend).toEqual({ max: 10, windowMs: 10 * 1000 });
    expect(config.rateLimits.typing).toEqual({ max: 1, windowMs: 1000 });
  });

  it('reports every invalid variable at once', () => {
    const err = configErrorOf(() => loadConfig({ NODE_ENV: 'development', PORT: 'not-a-port' }, { clientDistPath: missingClientDist }));

    expect(err.issues.map((issue) => issue.variable).sort()).toEqual(['APP_ORIGIN', 'DATABASE_URL', 'JWT_SECRET', 'PORT']);
    for (const variable of ['APP_ORIGIN', 'DATABASE_URL', 'JWT_SECRET', 'PORT']) {
      expect(err.message).toContain(variable);
    }
  });

  it.each(['development', 'test', 'production'])('B1: has no built-in JWT_SECRET fallback in %s', (nodeEnv) => {
    const { JWT_SECRET: _omitted, ...env } = { ...productionEnv, NODE_ENV: nodeEnv };
    const err = configErrorOf(() => loadConfig(env, { clientDistPath: clientDist }));

    expect(err.issues.map((issue) => issue.variable)).toEqual(['JWT_SECRET']);
  });

  it.each(['development', 'test', 'production'])('rejects a JWT_SECRET shorter than 32 bytes in %s without echoing it', (nodeEnv) => {
    const shortSecret = 'short-secret-31-bytes-long-xxxx';
    expect(Buffer.byteLength(shortSecret)).toBe(31);

    const err = configErrorOf(() => loadConfig({ ...productionEnv, NODE_ENV: nodeEnv, JWT_SECRET: shortSecret }, { clientDistPath: clientDist }));

    expect(err.issues.map((issue) => issue.variable)).toEqual(['JWT_SECRET']);
    expect(err.message).not.toContain(shortSecret);
  });

  it.each(['development', 'test', 'production'])('requires APP_ORIGIN and DATABASE_URL in %s', (nodeEnv) => {
    const { APP_ORIGIN: _origin, DATABASE_URL: _db, ...env } = { ...productionEnv, NODE_ENV: nodeEnv };
    const err = configErrorOf(() => loadConfig(env, { clientDistPath: clientDist }));

    expect(err.issues.map((issue) => issue.variable).sort()).toEqual(['APP_ORIGIN', 'DATABASE_URL']);
  });

  it('rejects an APP_ORIGIN that is not a bare http(s) origin', () => {
    for (const appOrigin of ['localhost:5173', 'ftp://example.com', 'https://example.com/app']) {
      const err = configErrorOf(() => loadConfig({ ...devEnv, APP_ORIGIN: appOrigin }, { clientDistPath: missingClientDist }));
      expect(err.issues.map((issue) => issue.variable)).toEqual(['APP_ORIGIN']);
    }
  });

  it('accepts DATABASE_URL=memory: only under NODE_ENV=test', () => {
    const config = loadConfig({ ...devEnv, NODE_ENV: 'test', DATABASE_URL: 'memory:' }, { clientDistPath: missingClientDist });
    expect(config.databaseUrl).toBe('memory:');

    for (const nodeEnv of ['development', 'production']) {
      const err = configErrorOf(() =>
        loadConfig({ ...productionEnv, NODE_ENV: nodeEnv, DATABASE_URL: 'memory:' }, { clientDistPath: clientDist })
      );
      expect(err.issues.map((issue) => issue.variable)).toEqual(['DATABASE_URL']);
    }
  });

  it('accepts a complete production configuration', () => {
    const config = loadConfig(productionEnv, { clientDistPath: clientDist });

    expect(config.nodeEnv).toBe('production');
    expect(config.storage).toEqual({
      provider: 'supabase',
      url: 'https://project.supabase.co',
      secretKey: 'sb_secret_example',
      bucket: 'attachments',
    });
    expect(config.clientDistPath).toBe(clientDist);
  });

  it.each([
    ['local', 'local'],
    ['empty', ''],
    ['missing', undefined],
  ])('rejects STORAGE_PROVIDER %s in production', (_label, provider) => {
    const env: Record<string, string | undefined> = { ...productionEnv, STORAGE_PROVIDER: provider };
    const err = configErrorOf(() => loadConfig(env, { clientDistPath: clientDist }));

    expect(err.issues.map((issue) => issue.variable)).toEqual(['STORAGE_PROVIDER']);
  });

  it('rejects production without the Supabase URL, bucket or secret key', () => {
    const { SUPABASE_URL: _u, SUPABASE_SECRET_KEY: _k, SUPABASE_STORAGE_BUCKET: _b, ...env } = productionEnv;
    const err = configErrorOf(() => loadConfig(env, { clientDistPath: clientDist }));

    expect(err.issues.map((issue) => issue.variable).sort()).toEqual([
      'SUPABASE_SECRET_KEY',
      'SUPABASE_STORAGE_BUCKET',
      'SUPABASE_URL',
    ]);
  });

  it('does not accept the legacy Supabase keys as the secret key', () => {
    const { SUPABASE_SECRET_KEY: _k, ...env } = productionEnv;
    const err = configErrorOf(() =>
      loadConfig({ ...env, SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role', SUPABASE_ANON_KEY: 'legacy-anon' }, { clientDistPath: clientDist })
    );

    expect(err.issues.map((issue) => issue.variable)).toEqual(['SUPABASE_SECRET_KEY']);
  });

  it('rejects production when the client build is missing', () => {
    const err = configErrorOf(() => loadConfig(productionEnv, { clientDistPath: missingClientDist }));

    expect(err.issues.map((issue) => issue.variable)).toEqual(['client build']);
  });

  it('serves the client build outside production only when it exists', () => {
    expect(loadConfig(devEnv, { clientDistPath: clientDist }).clientDistPath).toBe(clientDist);
    expect(loadConfig(devEnv, { clientDistPath: missingClientDist }).clientDistPath).toBeNull();
  });

  it('rejects an unknown NODE_ENV and LOG_LEVEL', () => {
    const err = configErrorOf(() => loadConfig({ ...devEnv, NODE_ENV: 'staging', LOG_LEVEL: 'loud' }, { clientDistPath: missingClientDist }));

    expect(err.issues.map((issue) => issue.variable).sort()).toEqual(['LOG_LEVEL', 'NODE_ENV']);
  });
});
