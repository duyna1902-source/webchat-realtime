# 05: Verify a fresh clone end to end

**What to build:** Confirm that a brand-new clone, set up only by following the README from the top, runs the app: an account can be registered through the Vite dev server with no proxy error, and the server picks up live edits to the shared package. This closes the spec's second open assumption (`tsx` watch reloads on changes to shared source resolved through the condition). If that is false, stop and report back instead of working around it. See `.scratch/fresh-clone-dev/spec.md`, Testing Decisions, manual verification.

This is a verification ticket. It changes no tracked files unless it finds a defect. A defect in the README goes back as a fix to the README itself, not as a workaround in the verification.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [x] Clone the branch into a new, empty temporary directory outside the working repository, and follow only the README's Getting Started steps.
- [x] After `npm install`, the compiled shared output exists. After deleting it, `npm run dev` still starts with no `ERR_MODULE_NOT_FOUND`, and the server logs that it is listening.
- [x] `POST /api/auth/register` through `http://localhost:5173` returns `201` with a session cookie, and `GET /api/auth/me` with that cookie returns `200`.
- [x] `GET http://localhost:4000/health/ready` returns `200`.
- [x] While `npm run dev` runs, a change to an exported value in the clone's shared source is observed by the server after its reload, without rebuilding the shared package.
- [x] `npm test` passes in the clone.
- [x] Security, unchanged session cookie: the cookie is still `__Host-session` with `HttpOnly`, `Secure` and `SameSite=Strict`.
- [x] Security, unchanged Origin check: a write request whose `Origin` is not `APP_ORIGIN` is still rejected.
- [x] Security, no test data on the network:
  - the database container publishes its port on `127.0.0.1` only
  - the dev servers are not started with `--host`
  - the registered account uses throwaway credentials that are not reused anywhere
- [x] Security, no secrets: none are used. The clone's `server/.env` comes from the example file and is never committed, pushed or copied into the working repository.
- [x] Security, nothing published: nothing is pushed from the clone.
- [x] Cleanup: the dev servers are stopped, the database container is removed, the temporary clone is deleted, and ports 4000, 5173 and 5432 are free again.
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

### 2026-11-10, verification run 2: all criteria pass

Before starting, HTTP and TCP probes on 127.0.0.1 and `[::1]` found nothing answering on 4000, 5173 or 5432, and no containers existed. The session that blocked run 1 had been stopped and its container and clone removed.

Clone: a new, empty scratch directory, then `git clone --branch fix/fresh-clone-dev D:/Project/webchat-realtime <scratch>/fc05c/webchat-realtime` at `ae00723`. Environment: Windows 11, Node 24.19.0, npm 11.17.0. Only the README's Getting Started steps were followed. The only network use was `npm install` and `docker pull postgres:16`. The whole run was one script with an exit trap that does the cleanup.

- **Step 2, `npm install`:** succeeded, and `shared/dist/` existed afterwards.
- **Step 3, `cp server/.env.example server/.env`:** defaults unchanged. `git status --ignored` shows `!! server/.env` as the clone's only non-`node_modules` entry.
- **Step 4, the README's `docker run ... -p 127.0.0.1:5432:5432 ... postgres:16`:** `docker port` shows `5432/tcp -> 127.0.0.1:5432` only. A TCP connect to the machine's LAN address on 5432 is refused.
- **Step 5, `npm run db:deploy --workspace=server`:** "All migrations have been successfully applied".
- **`rm -rf shared/dist`, then step 6, `npm run dev`:**
  - The `[SERVER]` log shows `"port":4000,"msg":"Server listening"`, with 0 `ERR_MODULE_NOT_FOUND`.
  - Vite prints `Network: use --host to expose`.
  - The process command lines are `vite.js` with no arguments and `tsx watch --conditions=@webchat/source src/index.ts`. None contains `--host`.
  - `Get-NetTCPConnection` lists only `:: 4000`. Vite listens on `localhost` (`::1`) only, and the LAN address on 5173 is refused.
- **Register through the proxy:** `POST http://localhost:5173/api/auth/register` with `Origin: http://localhost:5173` and a throwaway account (random `fc05_<hex>` username, `@example.invalid` email, 16 random bytes as password, never printed or reused) returns `201 Created`.
  - The response sets `__Host-session=...; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Strict`.
  - The dev log has 0 "proxy error" lines.
- **Session check:** `GET http://localhost:5173/api/auth/me` returns `200` with the cookie and the same user, and `401` without it.
- **Health:** `GET http://localhost:4000/health` returns `200 {"status":"ok"}`, and `/health/ready` returns `200 {"status":"ready"}`.
- **Origin check:** `POST /api/auth/logout` through `:5173` with a valid cookie is rejected both with `Origin: https://evil.example` and with neither `Origin` nor `Sec-Fetch-Site`. Each returns `403 {"message":"Cross-site request rejected","code":"FORBIDDEN"}`, and `/me` still returns `200` afterwards.
- **Live reload (spec assumption 2: confirmed):**
  - While `npm run dev` ran, with no `shared/dist`, `ERROR_CODES.FORBIDDEN` in the clone's `shared/src/errors.ts` was changed to `'FORBIDDEN_LIVE_RELOAD_PROBE'`.
  - `tsx` logged `change in ./..\shared\src\errors.ts Restarting...`, and within 3 s a new process logged "Server listening".
  - The same foreign-Origin request then returned `"code":"FORBIDDEN_LIVE_RELOAD_PROBE"`, and the server log showed the same code.
  - Reverting the file caused another restart, after which the code was `"FORBIDDEN"` again.
  - `shared/dist` was still absent, so nothing was rebuilt.
- **`npm test`:** not re-run. It passed in run 1 on the same commit with no `shared/dist`.

**Defects found:** none in the README or the branch. Two observations, both outside this spec:
- The known Vite `strictPort` issue is filed separately in `.scratch/vite-strict-port/`.
- The API server itself listens on all interfaces (`::`, port 4000) in development. That is `httpServer.listen(PORT)` without a host, not a `--host` flag, and it predates this spec.

**Security:**
- No secrets were used.
- The clone's `server/.env` stayed in the clone and was deleted with it.
- Nothing was committed or pushed from the clone.
- The session cookie value was redacted from all logs.

**Cleanup:**
- The dev process tree was stopped, and 0 node processes from the clone remain.
- The `webchat-postgres` container was removed.
- The clone directory was deleted.
- HTTP probes on 127.0.0.1 and `[::1]` find nothing on 4000, 5173 or 5432.
