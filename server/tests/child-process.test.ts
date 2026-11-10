import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { SERVER_ROOT, TSX_CLI, envWithoutServerConfig, stopChild } from './helpers/child-process.js';

const PRINT_PID_AND_WAIT = path.join(SERVER_ROOT, 'tests', 'fixtures', 'print-pid-and-wait.ts');

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilGone(pid: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !isAlive(pid);
}

/** The first line the child prints, read as a pid. */
function firstPid(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout?.on('data', (chunk) => {
      out += chunk.toString();
      if (out.includes('\n')) resolve(Number(out.split(/\r?\n/)[0]));
    });
    child.once('exit', (code) => reject(new Error(`Child exited (code ${code}) before printing its pid`)));
  });
}

describe('stopChild', () => {
  let child: ChildProcess | undefined;
  let innerPid: number | undefined;

  afterEach(() => {
    // Whatever the test found, leave no process behind.
    for (const pid of [innerPid, child?.pid]) {
      if (pid !== undefined && isAlive(pid)) process.kill(pid, 'SIGKILL');
    }
    child = undefined;
    innerPid = undefined;
  });

  it('stops the process tsx runs the script in, not just the tsx CLI', async () => {
    child = spawn(process.execPath, [TSX_CLI, PRINT_PID_AND_WAIT], {
      cwd: SERVER_ROOT,
      env: envWithoutServerConfig(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    innerPid = await firstPid(child);
    expect(isAlive(innerPid)).toBe(true);

    await stopChild(child);

    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    expect(await waitUntilGone(innerPid, 2000), `inner process ${innerPid} is still running`).toBe(true);
  }, 20000);

  it('returns even when the child ignores SIGTERM', async () => {
    child = spawn(
      process.execPath,
      ['-e', "process.on('SIGTERM', () => {}); console.log(process.pid); setInterval(() => {}, 1000);"],
      { env: envWithoutServerConfig(), stdio: ['ignore', 'pipe', 'pipe'] }
    );
    innerPid = await firstPid(child);

    const started = Date.now();
    await stopChild(child);

    expect(Date.now() - started).toBeLessThan(10000);
    expect(await waitUntilGone(innerPid, 2000)).toBe(true);
  }, 20000);
});
