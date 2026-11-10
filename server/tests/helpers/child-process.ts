import type { ChildProcess } from 'node:child_process';
import net from 'node:net';

/** Config variables a child server must never inherit from the test runner's environment. */
export const INHERITED_CONFIG_KEYS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'APP_ORIGIN',
  'STORAGE_PROVIDER',
  'VITEST',
  'VITEST_POOL_ID',
  'VITEST_WORKER_ID',
] as const;

/** A copy of the current environment with the inherited config variables removed. */
export function strippedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of INHERITED_CONFIG_KEYS) {
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

/**
 * Polls `${baseUrl}/health` until it answers 2xx. Fails with the captured output if the child
 * exits first or the deadline passes.
 */
export async function waitForHealth(
  baseUrl: string,
  child: ChildProcess,
  output: () => string,
  timeoutMs = 25000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
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

/** Kills the child if it is still running and waits for it to exit. */
export async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill();
  });
}
