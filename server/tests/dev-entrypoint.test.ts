import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile, spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { getFreePort, stopChild, strippedEnv, waitForHealth } from './helpers/child-process.js';

const require = createRequire(import.meta.url);
const SERVER_ROOT = path.resolve(__dirname, '..');
const SHARED_SRC = path.resolve(SERVER_ROOT, '../shared/src/index.ts');
const PRINT_SHARED_ENTRY = path.join(SERVER_ROOT, 'tests', 'fixtures', 'print-shared-entry.ts');
const TSX_CLI = require.resolve('tsx/cli');

interface TsxScript {
  name: string;
  /** The tsx/Node options before the entry file, without the `watch` subcommand. */
  options: string[];
  /** The entry file, relative to the server workspace. */
  entry: string;
}

/** Every server package script that runs `tsx`, read from the manifest so the tests follow it. */
function readTsxScripts(): TsxScript[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  return Object.entries(manifest.scripts)
    .filter(([, command]) => /^tsx(\s|$)/.test(command))
    .map(([name, command]) => {
      const tokens = command.split(/\s+/).slice(1).filter((token) => token !== 'watch');
      const entryIndex = tokens.findIndex((token) => !token.startsWith('-'));
      if (entryIndex === -1) throw new Error(`npm script "${name}" runs tsx without an entry file: ${command}`);
      return { name, options: tokens.slice(0, entryIndex), entry: tokens[entryIndex] };
    });
}

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
        ({ stdout } = await promisify(execFile)(process.execPath, [TSX_CLI, ...script.options, PRINT_SHARED_ENTRY], {
          cwd: SERVER_ROOT,
          env: strippedEnv(),
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
  let workDir: string;
  let child: ChildProcess | undefined;
  let baseUrl: string;
  let logs = '';

  beforeAll(async () => {
    const dev = TSX_SCRIPTS.find((script) => script.name === 'dev');
    if (!dev) throw new Error('The server manifest has no tsx "dev" script');

    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    // An empty `.env` stands in for the developer's own `server/.env`, which must not leak in.
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-dev-'));
    const dotenvPath = path.join(workDir, '.env');
    fs.writeFileSync(dotenvPath, '');

    child = spawn(process.execPath, [TSX_CLI, ...dev.options, path.join(SERVER_ROOT, dev.entry)], {
      cwd: SERVER_ROOT,
      env: {
        ...strippedEnv(),
        DOTENV_CONFIG_PATH: dotenvPath,
        NODE_ENV: 'test',
        PORT: String(port),
        DATABASE_URL: 'memory:',
        APP_ORIGIN: 'http://localhost:5173',
      },
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

  it('answers /health with 200', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});
