import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getFreePort, stopChild, strippedEnv, waitForHealth } from './helpers/child-process.js';

const require = createRequire(import.meta.url);
const SERVER_ROOT = path.resolve(__dirname, '..');
const ENTRYPOINT = path.join(SERVER_ROOT, 'src', 'index.ts');
const SHARED_SRC = path.resolve(SERVER_ROOT, '../shared/src/index.ts');
const TSX_CLI = require.resolve('tsx/cli');

// Not the origin the tests use elsewhere, so only the `.env` file can have put it in effect.
const DOTENV_APP_ORIGIN = 'http://dotenv-origin.test:5173';

// Reproduces audit step B1 (SEC-02): the entrypoint is started from a directory whose `.env`
// holds the only configuration. It must be loaded before any module reads its config: the server
// starts at all, and it checks request Origins against the APP_ORIGIN from that file.
describe('Entrypoint loads .env before anything else (B1)', () => {
  let workDir: string;
  let child: ChildProcess;
  let baseUrl: string;
  let logs = '';

  beforeAll(async () => {
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-b1-'));
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
    // Lets tsx resolve the shared workspace from source, without a prior build.
    fs.writeFileSync(
      path.join(workDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext', paths: { '@webchat/shared': [SHARED_SRC] } },
      })
    );

    // The child must see only what the `.env` file provides.
    const env = strippedEnv();

    child = spawn(process.execPath, [TSX_CLI, '--tsconfig', path.join(workDir, 'tsconfig.json'), ENTRYPOINT], {
      cwd: workDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk) => (logs += chunk.toString()));
    child.stderr?.on('data', (chunk) => (logs += chunk.toString()));

    await waitForHealth(baseUrl, child, () => logs);
  }, 30000);

  afterAll(async () => {
    await stopChild(child);
    if (workDir) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      } catch {
        // Ignored on Windows if file handle is slow to release
      }
    }
  });

  it('B1: the server runs with APP_ORIGIN from .env', async () => {
    const register = (origin: string, username: string) =>
      fetch(`${baseUrl}/api/auth/register`, {
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
