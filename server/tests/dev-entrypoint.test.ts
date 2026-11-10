import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  SERVER_ROOT,
  envWithoutServerConfig,
  getFreePort,
  makeTempDir,
  removeTempDir,
  spawnServer,
  stopChild,
  waitForHealth,
  type SpawnedServer,
} from './helpers/child-process.js';
import { nodeArgsFor, readTsxScripts } from './helpers/tsx-scripts.js';

const SHARED_SRC = path.resolve(SERVER_ROOT, '../shared/src/index.ts');
const PRINT_SHARED_ENTRY = path.join(SERVER_ROOT, 'tests', 'fixtures', 'print-shared-entry.ts');

const TSX_SCRIPTS = readTsxScripts();

describe('Server tsx commands read the shared package from source', () => {
  it('finds the tsx scripts in the server manifest', () => {
    expect(TSX_SCRIPTS.map((script) => script.name)).toContain('dev');
  });

  it.each(TSX_SCRIPTS.map((script) => [script.name, script] as const))(
    'npm script "%s" resolves @webchat/shared to its TypeScript source',
    async (name, script) => {
      let stdout: string;
      try {
        ({ stdout } = await promisify(execFile)(process.execPath, nodeArgsFor(script, PRINT_SHARED_ENTRY), {
          cwd: SERVER_ROOT,
          env: { ...envWithoutServerConfig(), ...script.env },
          timeout: 20000,
        }));
      } catch (err) {
        throw new Error(`npm script "${name}" cannot resolve @webchat/shared:\n${(err as { stderr?: string }).stderr ?? err}`);
      }
      const resolved = fileURLToPath(stdout.trim());
      expect(resolved, `npm script "${name}" must pass --conditions=@webchat/source`).toBe(SHARED_SRC);
    },
    25000
  );
});

// Starts the real entrypoint the way `npm run dev` does (from the server workspace, with the dev
// script's tsx options), minus watch mode. Nothing here depends on compiled shared output.
describe('The dev entrypoint starts', () => {
  let workDir: string | undefined;
  let server: SpawnedServer | undefined;

  beforeAll(async () => {
    const dev = TSX_SCRIPTS.find((script) => script.name === 'dev');
    if (!dev) throw new Error('The server manifest has no tsx "dev" script');

    const port = await getFreePort();

    // An empty `.env` stands in for the developer's own `server/.env`, which must not leak in.
    workDir = makeTempDir('webchat-dev-');
    const dotenvPath = path.join(workDir, '.env');
    fs.writeFileSync(dotenvPath, '');

    server = spawnServer({
      port,
      args: [...nodeArgsFor(dev, path.join(SERVER_ROOT, dev.entry)), ...dev.entryArgs],
      cwd: SERVER_ROOT,
      env: {
        ...envWithoutServerConfig(),
        ...dev.env,
        DOTENV_CONFIG_PATH: dotenvPath,
        NODE_ENV: 'test',
        PORT: String(port),
        DATABASE_URL: 'memory:',
        APP_ORIGIN: 'http://localhost:5173',
      },
    });
    await waitForHealth(server);
  }, 30000);

  afterAll(async () => {
    await stopChild(server?.child);
    removeTempDir(workDir);
  });

  it('answers /health with 200', async () => {
    const res = await fetch(`${server!.baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});
