import fs from 'node:fs';
import path from 'node:path';
import { SERVER_ROOT, TSX_CLI } from './child-process.js';

/** How an npm script runs a file through tsx, read from its command line. */
export interface TsxInvocation {
  /** `tsx` runs the tsx CLI; `node` loads tsx through a flag such as `--import tsx`. */
  runner: 'tsx' | 'node';
  /** Variables the command sets for itself (`X=1 tsx …`, `cross-env X=1 tsx …`). */
  env: Record<string, string>;
  /** The options before the entry file, without the `watch` subcommand and its watch-only flags. */
  options: string[];
  /** The entry file, relative to the server workspace. */
  entry: string;
  /** The arguments after the entry file. */
  entryArgs: string[];
}

export interface TsxScript extends TsxInvocation {
  name: string;
}

// Node and tsx flags whose value can follow as a separate argument (`--conditions X`).
const VALUE_FLAGS = new Set([
  '--conditions',
  '-C',
  '--import',
  '--require',
  '-r',
  '--loader',
  '--experimental-loader',
  '--env-file',
  '--env-file-if-exists',
  '--input-type',
  '--inspect-port',
  '--title',
  '--tsconfig',
  '--include',
  '--exclude',
  '--ignore',
]);
// Flags that only `tsx watch` understands. They go when watch mode is dropped.
const WATCH_ONLY_FLAGS = new Set(['--include', '--exclude', '--ignore', '--clear-screen']);
// Node flags that can load tsx into a plain `node` process.
const LOADER_FLAGS = new Set(['--import', '--require', '-r', '--loader', '--experimental-loader']);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;
// Anything a shell would expand or that would need real shell parsing to split.
const SHELL_SYNTAX = /['"`$\\(){}<>*?~]/;

const isTsxBinary = (token: string) => /^(?:.*\/)?tsx(?:\.cmd)?$/.test(token);
const isTsxModule = (token: string) => /^tsx(?:\/.*)?$/.test(token);
const mentionsTsx = (token: string) =>
  isTsxBinary(token) || isTsxModule(token) || /^-[\w-]*=tsx(?:\/.*)?$/.test(token);

/**
 * Reads how an npm script command runs tsx. Returns null when the command never mentions tsx.
 * Throws, naming the script, when it does but in a form this parser cannot turn into arguments,
 * so a script is never skipped silently.
 */
export function parseTsxCommand(name: string, command: string): TsxInvocation | null {
  const fail = (reason: string): never => {
    throw new Error(
      `npm script "${name}" runs tsx in a form the tests cannot read (${reason}): ${command}\n` +
        'Write it as `[cross-env VAR=value] tsx [watch] [options] <entry file>`, or extend tests/helpers/tsx-scripts.ts.'
    );
  };

  const segments = command
    .split(/&&|\|\||[;|&]/)
    .map((segment) => segment.trim().split(/\s+/).filter(Boolean))
    .filter((tokens) => tokens.some(mentionsTsx));
  if (segments.length === 0) return null;
  if (segments.length > 1) fail('more than one tsx call');
  const tokens = segments[0];
  if (tokens.some((token) => SHELL_SYNTAX.test(token))) fail('quoting or shell expansion');

  let i = 0;
  const env: Record<string, string> = {};
  const readEnv = () => {
    while (i < tokens.length && ENV_ASSIGNMENT.test(tokens[i])) {
      const [key, ...value] = tokens[i++].split('=');
      env[key] = value.join('=');
    }
  };
  readEnv();
  if (tokens[i] === 'cross-env') {
    i++;
    readEnv();
  }
  if (tokens[i] === 'npx') i++;

  const program = tokens[i++];
  const runner = isTsxBinary(program) ? 'tsx' : program === 'node' ? 'node' : fail(`tsx is not the command run`);

  let rest = tokens.slice(i);
  const watch = runner === 'tsx' && rest[0] === 'watch';
  if (watch) rest = rest.slice(1);

  const options: string[] = [];
  let j = 0;
  while (j < rest.length && rest[j].startsWith('-')) {
    const token = rest[j];
    if (token === '--') {
      j++;
      break;
    }
    const flag = token.split('=')[0];
    const width = !token.includes('=') && VALUE_FLAGS.has(flag) ? 2 : 1;
    if (j + width > rest.length) fail(`${flag} has no value`);
    if (!(watch && WATCH_ONLY_FLAGS.has(flag))) options.push(...rest.slice(j, j + width));
    j += width;
  }

  const entry = rest[j];
  if (entry === undefined) fail('no entry file');
  if (!SCRIPT_FILE.test(entry)) {
    fail(`expected an entry file but found "${entry}"; if a flag before it takes a value, add it to VALUE_FLAGS`);
  }

  if (runner === 'node') {
    const loadsTsx = options.some(
      (option, k) =>
        (LOADER_FLAGS.has(option) && isTsxModule(options[k + 1] ?? '')) ||
        (LOADER_FLAGS.has(option.split('=')[0]) && isTsxModule(option.slice(option.indexOf('=') + 1)))
    );
    if (!loadsTsx) fail('node does not load tsx through a loader flag');
  }

  return { runner, env, options, entry, entryArgs: rest.slice(j + 1) };
}

/** Every server package script that runs tsx, read from the manifest so the tests follow it. */
export function readTsxScripts(): TsxScript[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(SERVER_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  return Object.entries(manifest.scripts).flatMap(([name, command]) => {
    const invocation = parseTsxCommand(name, command);
    return invocation ? [{ name, ...invocation }] : [];
  });
}

/** The `node` arguments that run `entry` the way the script runs its own entry file. */
export function nodeArgsFor(script: TsxInvocation, entry: string): string[] {
  return script.runner === 'tsx' ? [TSX_CLI, ...script.options, entry] : [...script.options, entry];
}
