import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SERVER_ROOT,
  TSX_CLI,
  envWithoutServerConfig,
  getFreePort,
  makeTempDir,
  removeTempDir,
  spawnServer,
  stopChild,
  waitForHealth,
  type SpawnedServer,
} from './helpers/child-process.js';

const ENTRYPOINT = path.join(SERVER_ROOT, 'src', 'index.ts');

// Not the origin the tests use elsewhere, so only the `.env` file can have put it in effect.
const DOTENV_APP_ORIGIN = 'http://dotenv-origin.test:5173';

// Reproduces audit step B1 (SEC-02): the entrypoint is started from a directory whose `.env`
// holds the only configuration. It must be loaded before any module reads its config: the server
// starts at all, and it checks request Origins against the APP_ORIGIN from that file.
describe('Entrypoint loads .env before anything else (B1)', () => {
  let workDir: string | undefined;
  let server: SpawnedServer | undefined;

  beforeAll(async () => {
    const port = await getFreePort();

    workDir = makeTempDir('webchat-b1-');
    fs.writeFileSync(
      path.join(workDir, '.env'),
      [
        'NODE_ENV=test',
        `PORT=${port}`,
        'DATABASE_URL=memory:',
        `APP_ORIGIN=${DOTENV_APP_ORIGIN}`,
        '',
      ].join('\n')
    );

    // The child must see only what the `.env` file provides. It reads the shared workspace from
    // source, as the server's tsx scripts do, without a prior build.
    server = spawnServer({
      port,
      args: [TSX_CLI, '--conditions=@webchat/source', ENTRYPOINT],
      cwd: workDir,
      env: envWithoutServerConfig(),
    });
    await waitForHealth(server);
  }, 30000);

  afterAll(async () => {
    await stopChild(server?.child);
    removeTempDir(workDir);
  });

  it('B1: the server runs with APP_ORIGIN from .env', async () => {
    const register = (origin: string, username: string) =>
      fetch(`${server!.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ username, email: `${username}@example.com`, password: 'password123' }),
      });

    expect((await register('http://localhost:5173', 'alice')).status).toBe(403);

    const res = await register(DOTENV_APP_ORIGIN, 'bob');
    expect(res.status).toBe(201);
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-session=/);
  });
});
