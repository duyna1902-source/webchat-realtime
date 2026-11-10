# 05: Verify a fresh clone end to end

**What to build:** Confirm that a brand-new clone, set up only by following the README from the top, runs the app: an account can be registered through the Vite dev server with no proxy error, and the server picks up live edits to the shared package. This closes the spec's second open assumption (`tsx` watch reloads on changes to shared source resolved through the condition). If that is false, stop and report back instead of working around it. See `.scratch/fresh-clone-dev/spec.md`, Testing Decisions, manual verification.

This is a verification ticket. It changes no tracked files unless it finds a defect. A defect in the README goes back as a fix to the README itself, not as a workaround in the verification.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [x] Clone the branch into a new, empty temporary directory outside the working repository, and follow only the README's Getting Started steps.
- [ ] After `npm install`, the compiled shared output exists. After deleting it, `npm run dev` still starts with no `ERR_MODULE_NOT_FOUND`, and the server logs that it is listening.
- [ ] `POST /api/auth/register` through `http://localhost:5173` returns `201` with a session cookie, and `GET /api/auth/me` with that cookie returns `200`.
- [ ] `GET http://localhost:4000/health/ready` returns `200`.
- [ ] While `npm run dev` runs, a change to an exported value in the clone's shared source is observed by the server after its reload, without rebuilding the shared package.
- [x] `npm test` passes in the clone.
- [ ] Security, unchanged session cookie: the cookie is still `__Host-session` with `HttpOnly`, `Secure` and `SameSite=Strict`.
- [ ] Security, unchanged Origin check: a write request whose `Origin` is not `APP_ORIGIN` is still rejected.
- [ ] Security, no test data on the network:
  - the database container publishes its port on `127.0.0.1` only
  - the dev servers are not started with `--host`
  - the registered account uses throwaway credentials that are not reused anywhere
- [x] Security, no secrets: none are used. The clone's `server/.env` comes from the example file and is never committed, pushed or copied into the working repository.
- [x] Security, nothing published: nothing is pushed from the clone.
- [ ] Cleanup: the dev servers are stopped, the database container is removed, the temporary clone is deleted, and ports 4000, 5173 and 5432 are free again.
- [x] A short verification report (commands run, results, any defects found) is appended under `## Comments` in this file.

## Comments

### 2026-11-10, verification run 1: blocked by a port conflict (incomplete)

Clone: `git clone --branch fix/fresh-clone-dev D:/Project/webchat-realtime <scratch>/fc05/webchat-realtime` at `ae00723`, Windows 11, Node 24.19.0, npm 11.17.0, Docker Desktop 29.9.2. Only the README's Getting Started steps were followed.

- **Pre-check:** `Get-NetTCPConnection` and `netstat` showed 4000, 5173 and 5432 free and no containers. That check turned out to be blind (see below).
- **Step 2, `npm install`:** succeeded and ran `prisma generate`. `shared/dist/` existed afterwards.
- **Step 3:** `cp server/.env.example server/.env`. The defaults were used unchanged and the file stayed ignored (`git status --ignored` shows `!! server/.env`).
- **Step 4:** `docker pull postgres:16`, then the README's `docker run ... -p 127.0.0.1:5432:5432 ...`. `docker port` showed `5432/tcp -> 127.0.0.1:5432` only.
- **Step 5:** `npm run db:deploy --workspace=server` reported "All migrations have been successfully applied".
- **`rm -rf shared/dist`**, then `npm run db:upgrade-data --workspace=server -- --dry-run`: ran with no build and reported "Total: 0 changes". The operator command works on a fresh clone.
- **Step 6, `npm run dev`:** no `ERR_MODULE_NOT_FOUND`. The server loaded its whole module graph from shared source and reached `server.listen()` (`server/src/index.ts:15`). It then failed with `EADDRINUSE :::4000`. Vite printed "Port 5173 is in use, trying another one..." and moved to 5174, without `--host` ("use --host to expose").
- **Cause:** a dev session the verifier did not start was already holding 4000 and 5173, running from `D:\Project\clone_webchat\webchat-realtime` (`tsx watch src/index.ts`, `vite`). HTTP probes reached both ports (`:4000/` answered 404, `:5173/` answered 200), but the sandboxed `Get-NetTCPConnection` and `netstat` did not list those sockets. That session was left running. Only the verifier's own processes were stopped.
- **`npm test` in the clone, with no `shared/dist`:** server 39 files / 417 tests passed, client 21 files / 205 tests passed.

**Not verified:** the server's "listening" log, register/`me` through `:5173`, `/health/ready`, the cookie attributes, the Origin rejection, and live reload of shared source. The spec's second assumption, that `tsx watch` reloads on condition-resolved shared source, is therefore **still open**. Re-run once ports 4000 and 5173 are free.

**Defects found:** none in the README or the branch.

**Observation, outside this spec:** when 5173 is busy, Vite silently moves to the next port, which no longer matches `APP_ORIGIN`, so every write would be refused. `server.strictPort: true` in `client/vite.config.ts`, or a Troubleshooting line, would make this fail loudly.

**Security:** no secrets were used, nothing was committed or pushed from the clone, and the clone's `.env` never left it. No account was registered.

**Cleanup:** the verifier's dev processes were stopped, the `webchat-postgres` container was removed, and the clone and its log were deleted. Ports 5174 and 5432 are free. Ports 4000 and 5173 are still held by the other session noted above.
