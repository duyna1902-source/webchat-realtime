import { describe, it, expect } from 'vitest';
import { parseTsxCommand } from './helpers/tsx-scripts.js';

// The parser behind tests/dev-entrypoint.test.ts. It must find every way an npm script can run
// tsx, and fail loudly, naming the script, when it cannot turn one into arguments.
describe('parseTsxCommand', () => {
  it('reads a direct tsx call and drops watch mode', () => {
    expect(parseTsxCommand('dev', 'tsx watch --conditions=@webchat/source src/index.ts')).toEqual({
      runner: 'tsx',
      env: {},
      options: ['--conditions=@webchat/source'],
      entry: 'src/index.ts',
      entryArgs: [],
    });
  });

  it.each([
    ['--conditions X', 'tsx --conditions @webchat/source src/cli/a.ts', ['--conditions', '@webchat/source']],
    ['-C X', 'tsx -C @webchat/source src/cli/a.ts', ['-C', '@webchat/source']],
    [
      '--tsconfig x',
      'tsx --tsconfig tsconfig.dev.json --conditions=@webchat/source src/cli/a.ts',
      ['--tsconfig', 'tsconfig.dev.json', '--conditions=@webchat/source'],
    ],
    ['--import x', 'tsx --import ./register.js src/cli/a.ts', ['--import', './register.js']],
  ])('keeps the value of a flag written as %s', (_form, command, options) => {
    expect(parseTsxCommand('cmd', command)).toMatchObject({ options, entry: 'src/cli/a.ts' });
  });

  it('drops watch-only flags along with watch mode', () => {
    expect(
      parseTsxCommand('dev', 'tsx watch --include ../shared/src --clear-screen=false --conditions=X src/index.ts')
    ).toMatchObject({ options: ['--conditions=X'], entry: 'src/index.ts' });
  });

  it('keeps the arguments after the entry file apart', () => {
    expect(parseTsxCommand('cmd', 'tsx --conditions=X src/cli/a.ts --dry-run 3')).toMatchObject({
      entry: 'src/cli/a.ts',
      entryArgs: ['--dry-run', '3'],
    });
  });

  it.each([
    ['an env prefix', 'NODE_OPTIONS=--trace-warnings tsx src/a.ts', { NODE_OPTIONS: '--trace-warnings' }],
    ['cross-env', 'cross-env X=1 Y=2 tsx src/a.ts', { X: '1', Y: '2' }],
  ])('finds tsx behind %s and keeps its variables', (_form, command, env) => {
    expect(parseTsxCommand('cmd', command)).toMatchObject({ runner: 'tsx', env, entry: 'src/a.ts' });
  });

  it.each([
    ['after &&', 'prisma generate && tsx --conditions=X src/a.ts'],
    ['after ;', 'echo start; tsx --conditions=X src/a.ts'],
    ['through npx', 'npx tsx --conditions=X src/a.ts'],
    ['by path', '../node_modules/.bin/tsx --conditions=X src/a.ts'],
  ])('finds tsx %s', (_form, command) => {
    expect(parseTsxCommand('cmd', command)).toMatchObject({
      runner: 'tsx',
      options: ['--conditions=X'],
      entry: 'src/a.ts',
    });
  });

  it.each([
    ['node --import tsx', 'node --import tsx --conditions=X src/a.ts', ['--import', 'tsx', '--conditions=X']],
    ['node --import=tsx', 'node --import=tsx src/a.ts', ['--import=tsx']],
    ['node --require tsx/cjs', 'node --require tsx/cjs src/a.ts', ['--require', 'tsx/cjs']],
  ])('reads tsx loaded through %s as node options', (_form, command, options) => {
    expect(parseTsxCommand('cmd', command)).toEqual({ runner: 'node', env: {}, options, entry: 'src/a.ts', entryArgs: [] });
  });

  it.each([
    'vitest run',
    'prisma generate && tsc',
    'node dist/index.js',
    'node scripts/generate-schema-sql.mjs',
    'tsc -p tsconfig.json',
  ])('ignores a script that does not run tsx: %s', (command) => {
    expect(parseTsxCommand('cmd', command)).toBeNull();
  });

  it.each([
    ['quoting', `tsx -e "console.log(1)"`],
    ['a shell variable', 'tsx $ENTRY'],
    ['no entry file', 'tsx watch --conditions=X'],
    ['an unknown flag that takes a value', 'tsx --some-flag value src/a.ts'],
    ['two tsx calls', 'tsx src/a.ts && tsx src/b.ts'],
    ['tsx as an argument of another command', 'echo tsx'],
    ['node with tsx but no loader flag', 'node tsx src/a.ts'],
  ])('fails loudly, naming the script, on %s', (_form, command) => {
    expect(() => parseTsxCommand('my-script', command)).toThrow(/npm script "my-script"/);
  });
});
