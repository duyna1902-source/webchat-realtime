# 01: Server dev and operator commands read the shared package from source

**What to build:** On a fresh clone with no compiled shared output, `npm run dev`, `npm run dev:server`, the data upgrade command and the session revocation command all start without `ERR_MODULE_NOT_FOUND`.

The shared contracts package exposes its TypeScript entry point under the `@webchat/source` export condition, and every server command run through `tsx` opts into it. `npm test` guards this behavior, so removing the opt-in, or adding a `tsx` command without it, fails locally. See `.scratch/fresh-clone-dev/spec.md`: Implementation Decisions, and Testing Decisions, Seam 1.

Prefactor first: move the child-process helpers (free-port probe, health polling with an early-exit check) out of the existing entrypoint `.env` test into the server test helpers. That test and the new one then share them.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] The free-port and health-polling helpers live in the server test helpers, and the entrypoint `.env` test uses them, with its behavior unchanged.
- [x] The shared package's exports have a `@webchat/source` condition pointing at its TypeScript entry point, ordered before `types`, `import` and `default`. Without the condition, resolution still gives the compiled output.
- [x] Every server package script that runs `tsx` passes `--conditions=@webchat/source`.
- [x] The `paths` mapping for `@webchat/shared` is removed from `server/tsconfig.json`. When the compiled shared output existed, `tsx` applied that mapping ahead of the condition and loaded the compiled output. With the mapping gone, `tsc --noEmit` and `npm run build` still pass, using the shared package's `types` export.
- [x] The production start command does not pass the condition and still runs the compiled server on the compiled shared output.
- [x] A new server test finds every `tsx` script in the server's package manifest, runs a child process with that script's arguments, and asserts `@webchat/shared` resolves to the shared TypeScript entry point. A failure names the script.
- [x] The same test file starts the server entrypoint with the `dev` script's `tsx` arguments (no watch mode, `NODE_ENV=test`, in-memory database, free port) and asserts `/health` answers `200`. On an early exit it reports the captured output.
- [x] No test deletes or modifies files in the working copy, including the compiled shared output.
- [x] The entrypoint `.env` test no longer writes a temporary path-mapping `tsconfig.json` and passes the condition instead. Its assertions are unchanged.
- [ ] Security: the child-process tests keep the existing hygiene. Each child gets an explicit environment with inherited config variables stripped, uses an in-memory database and no real secrets, listens only on `127.0.0.1`, and is killed (and its temp directory removed) in teardown even when an assertion fails.
  - Open: the child server listens on all interfaces, because `server/src/index.ts` calls `listen` without a host argument. This limitation predates this ticket and is left for a follow-up ticket. Only the free-port probe binds `127.0.0.1`.
- [x] With compiled shared output deleted by hand, `npm run dev:server` logs that the server is listening. Restore it afterwards with `npm run build:shared`.
- [x] `npm test` passes, both with and without the compiled shared output.

## Comments

- 2026-11-10: Resolved on `fix/fresh-clone-dev`. The "listens only on `127.0.0.1`" criterion stays open by the maintainer's decision: `server/src/index.ts` calls `listen(port)` with no host. This predates the ticket and is left for a follow-up.
