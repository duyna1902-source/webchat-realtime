import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';

// Ticket 19 (SEC-18): the operator documentation must match the code it describes.

const REPO_ROOT = path.resolve(__dirname, '../..');

/** Every variable an env file names, whether set or commented out as an optional example. */
function variablesListedIn(envFile: string): string[] {
  const text = fs.readFileSync(path.join(REPO_ROOT, envFile), 'utf8');
  const names = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match) names.add(match[1]);
  }
  return [...names].sort();
}

/** Every variable `loadConfig` reads, observed by handing it an environment that records lookups. */
function variablesReadByConfig(): string[] {
  const read = new Set<string>();
  // Production with Supabase storage takes every branch, so every variable gets looked up.
  const productionEnv: Record<string, string> = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/webchat',
    APP_ORIGIN: 'https://webchat-realtime.onrender.com',
    STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_example',
    SUPABASE_STORAGE_BUCKET: 'attachments',
  };
  const recordingEnv = new Proxy(productionEnv, {
    get(target, key) {
      if (typeof key === 'string') read.add(key);
      return Reflect.get(target, key);
    },
  });
  const clientDist = fs.mkdtempSync(path.join(os.tmpdir(), 'webchat-docs-dist-'));
  try {
    fs.writeFileSync(path.join(clientDist, 'index.html'), '<!doctype html>');
    loadConfig(recordingEnv, { clientDistPath: clientDist });
  } finally {
    fs.rmSync(clientDist, { recursive: true, force: true });
  }
  return [...read].sort();
}

/** Documents this ticket writes or updates; every internal link in them must open. */
const DOCS = [
  'SECURITY.md',
  'README.md',
  'docs/incident-runbook.md',
  'docs/database-migrations.md',
  'docs/adr/SYSTEM_ARCHITECTURE.md',
  'docs/adr/0002-tech-stack-and-free-tier-hosting.md',
  'docs/adr/0004-offline-sync-and-attachment-strategy.md',
  'docs/adr/0005-monorepo-structure-and-shared-contracts.md',
  'docs/adr/0009-private-attachments-via-records-and-signed-urls.md',
  'docs/adr/0010-single-host-render-with-session-cookie.md',
];

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
}

/** Drops fenced code blocks and inline code, where `[x](y)` is not a link. */
function withoutCode(markdown: string): string {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
}

/** Link targets: Markdown `[text](target)` and HTML `href`/`src` attributes. */
function linkTargets(markdown: string): string[] {
  const text = withoutCode(markdown);
  const targets: string[] = [];
  for (const match of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) targets.push(match[1]);
  for (const match of text.matchAll(/\b(?:href|src)="([^"]+)"/g)) targets.push(match[1]);
  return targets;
}

/** The anchor GitHub gives a heading (github-slugger rules). */
function githubSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

function anchorsOf(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const match of withoutCode(markdown).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const slug = githubSlug(match[1].replace(/`/g, ''));
    const count = seen.get(slug) ?? 0;
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
    seen.set(slug, count + 1);
  }
  for (const match of markdown.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) anchors.add(match[1]);
  return anchors;
}

/** Internal links of one document that do not open: a missing file or a missing heading anchor. */
function brokenLinks(doc: string): string[] {
  const broken: string[] = [];
  for (const target of linkTargets(readRepoFile(doc))) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // https:, mailto: ... are external
    const [rawPath, anchor] = target.split('#');
    const file = rawPath ? path.posix.join(path.posix.dirname(doc), decodeURI(rawPath)) : doc;
    if (!fs.existsSync(path.join(REPO_ROOT, file))) {
      broken.push(`${target} (no such file: ${file})`);
      continue;
    }
    const isMarkdown = file.endsWith('.md');
    if (anchor && isMarkdown && !anchorsOf(readRepoFile(file)).has(decodeURIComponent(anchor))) {
      broken.push(`${target} (no heading #${anchor} in ${file})`);
    }
  }
  return broken;
}

describe('Internal links in the documentation open', () => {
  for (const doc of DOCS) {
    it(`every internal link in ${doc} resolves`, () => {
      expect(fs.existsSync(path.join(REPO_ROOT, doc)), `${doc} exists`).toBe(true);
      expect(brokenLinks(doc)).toEqual([]);
    });
  }
});

describe('The incident runbook matches the code', () => {
  it('documents every security event name the server logs', () => {
    const source = readRepoFile('server/src/lib/security-events.ts');
    const union = /export type SecurityEvent =([^;]+);/.exec(source)?.[1] ?? '';
    const events = [...union.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(events.length).toBeGreaterThan(10);

    const runbook = readRepoFile('docs/incident-runbook.md');
    expect(events.filter((event) => !runbook.includes(`\`${event}\``))).toEqual([]);
  });

  it('only names npm scripts that exist', () => {
    const scriptsOf = (pkg: string) => Object.keys(JSON.parse(readRepoFile(pkg)).scripts ?? {});
    const missing: string[] = [];
    for (const doc of ['SECURITY.md', 'README.md', 'docs/incident-runbook.md']) {
      for (const match of readRepoFile(doc).matchAll(/npm run ([\w:-]+)(?:\s+--workspace=(\w+))?/g)) {
        const [, script, workspace] = match;
        const pkg = workspace ? `${workspace}/package.json` : 'package.json';
        if (!scriptsOf(pkg).includes(script)) missing.push(`${doc}: npm run ${script} (${pkg})`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('.env.example matches the configuration module', () => {
  for (const envFile of ['.env.example', 'server/.env.example']) {
    it(`${envFile} lists exactly the variables loadConfig reads`, () => {
      expect(variablesListedIn(envFile)).toEqual(variablesReadByConfig());
    });

    it(`${envFile} no longer mentions removed variables`, () => {
      const text = fs.readFileSync(path.join(REPO_ROOT, envFile), 'utf8');
      for (const removed of ['JWT_SECRET', 'CLOUDINARY', 'VITE_API_URL', 'VITE_SOCKET_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_URL']) {
        expect(text).not.toContain(removed);
      }
    });
  }
});
