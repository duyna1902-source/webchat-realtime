import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);
const SERVER_ROOT = path.resolve(__dirname, '..');
const ENTRYPOINT = path.join(SERVER_ROOT, 'src', 'index.ts');
const SHARED_SRC = path.resolve(SERVER_ROOT, '../shared/src/index.ts');
const TSX_CLI = require.resolve('tsx/cli');

const DOTENV_SECRET = 'from-dotenv-file-secret-at-least-32-bytes-long';
const LEAKED_DEFAULT_SECRET = 'webchat-realtime-default-secret-key-32-chars';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, child: ChildProcess, output: () => string): Promise<void> {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early (code ${child.exitCode}):\n${output()}`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become healthy in time:\n${output()}`);
}

// Reproduces audit step B1 (SEC-02): the entrypoint is started from a directory whose
// `.env` holds the only JWT_SECRET. The issued token must be signed with that secret.
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
        'APP_ORIGIN=http://localhost:5173',
        `JWT_SECRET=${DOTENV_SECRET}`,
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
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of ['NODE_ENV', 'PORT', 'DATABASE_URL', 'APP_ORIGIN', 'JWT_SECRET', 'STORAGE_PROVIDER', 'VITEST', 'VITEST_POOL_ID', 'VITEST_WORKER_ID']) {
      delete env[key];
    }

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
    if (child && child.exitCode === null) {
      await new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
        child.kill();
      });
    }
    if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('B1: token issued at registration is signed with JWT_SECRET from .env, not a built-in default', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', email: 'alice@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(201);
    const { token } = (await res.json()) as { token: string };

    expect(() => jwt.verify(token, LEAKED_DEFAULT_SECRET)).toThrow();
    expect(() => jwt.verify(token, DOTENV_SECRET)).not.toThrow();
  });
});
