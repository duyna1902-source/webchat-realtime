# 02: `npm install` builds the shared package so the editor has types

**What to build:** After `npm install` on a checkout with no compiled shared output, the compiled output and its declaration files exist, so the editor shows types for the server's imports of `@webchat/shared`.

The root install hook builds the shared package and then generates the Prisma client. This is for the editor only: per ticket 01, the app does not depend on it. See `.scratch/fresh-clone-dev/spec.md`, Implementation Decisions.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The root `postinstall` builds the shared package before generating the Prisma client, and fails if either step fails.
- [x] With the compiled shared output deleted, `npm install` recreates it, declaration files included.
- [x] The server's TypeScript path mapping is unchanged. (Superseded: ticket 01 later removed the mapping, because `tsx` preferred it to the source condition. TypeScript now finds the types through the shared package's `types` export.)
- [x] No pre-dev build hook and no shared watcher process are added.
- [x] The production build command (`npm run build`) and the Render build and start commands are unchanged and still succeed.
- [x] Security: the install hook runs only the repository's own `tsc` and `prisma generate`, with no network access or downloads of its own. No new dependency is added, and the root `allowScripts` list is unchanged.
- [x] `npm test` passes.

## Verification (by hand, 2026-11-10, Windows 11, Node 24.19.0, npm 11.17.0)

- Fresh worktree with no `node_modules` and no `shared/dist`: `npm install` exited 0; `shared/dist` held `index.js` and seven `.d.ts` files, and the Prisma client was generated after the shared build.
- `rm -rf shared/dist && npm install`: the hook ran `npm run build --workspace=shared && npm run db:generate --workspace=server`, exited 0, and recreated `shared/dist/index.js` and `shared/dist/index.d.ts`.
- `npx tsc --noEmit` in `server/` (path mapping still points at `../shared/dist/index.d.ts`) exited 0, so the server's imports of `@webchat/shared` have types.
- With a temporary type error in `shared/src`, `npm run postinstall` exited 2 at the shared build and did not run `prisma generate`.
- `npm run build` exited 0. The Render start command needs a database and was not run; it is unchanged.
