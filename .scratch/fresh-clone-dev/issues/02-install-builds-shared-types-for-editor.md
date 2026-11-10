# 02: `npm install` builds the shared package so the editor has types

**What to build:** After `npm install` on a checkout with no compiled shared output, the compiled output and its declaration files exist, so the editor shows types for the server's imports of `@webchat/shared`.

The root install hook builds the shared package and then generates the Prisma client. This is for the editor only: per ticket 01, the app does not depend on it. See `.scratch/fresh-clone-dev/spec.md`, Implementation Decisions.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The root `postinstall` builds the shared package before generating the Prisma client, and fails if either step fails.
- [ ] With the compiled shared output deleted, `npm install` recreates it, declaration files included.
- [ ] The server's TypeScript path mapping is unchanged.
- [ ] No pre-dev build hook and no shared watcher process are added.
- [ ] The production build command (`npm run build`) and the Render build and start commands are unchanged and still succeed.
- [ ] Security: the install hook runs only the repository's own `tsc` and `prisma generate`, with no network access or downloads of its own. No new dependency is added, and the root `allowScripts` list is unchanged.
- [ ] `npm test` passes.
