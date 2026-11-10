import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The server workspace, where the server's npm scripts run. */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The tsx CLI entry, run with `process.execPath` so no shell or `.bin` shim is involved. */
export const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli');

/** Config variables a child server must never pick up from the test runner's environment. */
const SERVER_CONFIG_KEYS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'APP_ORIGIN',
  'STORAGE_PROVIDER',
  'VITEST',
  'VITEST_POOL_ID',
  'VITEST_WORKER_ID',
] as const;

/** A copy of the current environment without any server config variables. */
export function envWithoutServerConfig(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of SERVER_CONFIG_KEYS) {
    delete env[key];
  }
  return env;
}

/** A TCP port on 127.0.0.1 that was free a moment ago. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/** A fresh directory under the OS temp directory. */
export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Removes a directory made by `makeTempDir`, tolerating Windows releasing file handles slowly. */
export function removeTempDir(dir: string | undefined): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    // A leftover temp directory is harmless; failing the teardown over it is not.
  }
}

/** A server child process with its captured output. */
export interface SpawnedServer {
  baseUrl: string;
  child: ChildProcess;
  /** Everything the child has written to stdout and stderr so far. */
  logs: () => string;
}

/**
 * Spawns `node <args>` as a server listening on `port`, capturing its output. Assign the result
 * before awaiting `waitForHealth`, so teardown can stop the child even if it never gets healthy.
 */
export function spawnServer(options: { port: number; args: string[]; cwd: string; env: NodeJS.ProcessEnv }): SpawnedServer {
  const child = spawn(process.execPath, options.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout?.on('data', (chunk) => (logs += chunk.toString()));
  child.stderr?.on('data', (chunk) => (logs += chunk.toString()));
  return { baseUrl: `http://127.0.0.1:${options.port}`, child, logs: () => logs };
}

const HEALTH_DEADLINE_MS = 25000;
const HEALTH_REQUEST_TIMEOUT_MS = 1000;

/**
 * Polls `${baseUrl}/health` until it answers 2xx. Fails with the captured output if the child
 * exits first or the deadline passes. Each request is aborted after a second, so a server that
 * accepts connections but never answers cannot hold the poll past its deadline.
 */
export async function waitForHealth(server: SpawnedServer): Promise<void> {
  const deadline = Date.now() + HEALTH_DEADLINE_MS;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(`Server exited early (code ${server.child.exitCode}):\n${server.logs()}`);
    }
    const timeout = Math.max(1, Math.min(HEALTH_REQUEST_TIMEOUT_MS, deadline - Date.now()));
    try {
      const res = await fetch(`${server.baseUrl}/health`, { signal: AbortSignal.timeout(timeout) });
      if (res.ok) return;
    } catch {
      // Not listening yet, or the request timed out
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become healthy in time:\n${server.logs()}`);
}

const STOP_GRACE_MS = 3000;
const STOP_GIVE_UP_MS = 3000;

const hasExited = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

/** Resolves true once the child exits, or false after `ms`. */
function exitWithin(child: ChildProcess, ms: number): Promise<boolean> {
  if (hasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, ms);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once('exit', onExit);
  });
}

/** Force-kills a process and every process it started (Windows has no process-group signals). */
function killTreeOnWindows(pid: number): Promise<void> {
  return new Promise((resolve) => {
    // Errors are ignored: the most likely one is that the tree has already exited.
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { timeout: STOP_GRACE_MS, windowsHide: true }, () =>
      resolve()
    );
  });
}

/**
 * Stops the child if it is still running and waits, for a bounded time, until it has exited.
 * tsx runs the script in an inner node process, so on Windows the whole process tree is killed:
 * killing only the outer process would leave the inner one, and the server, running. Elsewhere
 * the child gets SIGTERM, which tsx relays, then SIGKILL. Teardown never hangs: if the child is
 * still alive after that, this gives up with a warning.
 */
export async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child || hasExited(child)) return;

  if (process.platform === 'win32' && child.pid !== undefined) {
    await killTreeOnWindows(child.pid);
  } else {
    child.kill('SIGTERM');
  }
  if (await exitWithin(child, STOP_GRACE_MS)) return;

  child.kill('SIGKILL');
  if (await exitWithin(child, STOP_GIVE_UP_MS)) return;

  console.warn(`Child process ${child.pid} did not exit after SIGKILL; giving up on it`);
}
