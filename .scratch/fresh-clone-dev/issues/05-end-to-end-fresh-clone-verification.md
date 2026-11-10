# 05: Verify a fresh clone end to end

**What to build:** Confirm that a brand-new clone, set up only by following the README from the top, runs the app: an account can be registered through the Vite dev server with no proxy error, and the server picks up live edits to the shared package. This closes the spec's second open assumption (`tsx` watch reloads on changes to shared source resolved through the condition). If that is false, stop and report back instead of working around it. See `.scratch/fresh-clone-dev/spec.md`, Testing Decisions, manual verification.

This is a verification ticket. It changes no tracked files unless it finds a defect. A defect in the README goes back as a fix to the README itself, not as a workaround in the verification.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [ ] Clone the branch into a new, empty temporary directory outside the working repository, and follow only the README's Getting Started steps.
- [ ] After `npm install`, the compiled shared output exists. After deleting it, `npm run dev` still starts with no `ERR_MODULE_NOT_FOUND`, and the server logs that it is listening.
- [ ] `POST /api/auth/register` through `http://localhost:5173` returns `201` with a session cookie, and `GET /api/auth/me` with that cookie returns `200`.
- [ ] `GET http://localhost:4000/health/ready` returns `200`.
- [ ] While `npm run dev` runs, a change to an exported value in the clone's shared source is observed by the server after its reload, without rebuilding the shared package.
- [ ] `npm test` passes in the clone.
- [ ] Security, unchanged session cookie: the cookie is still `__Host-session` with `HttpOnly`, `Secure` and `SameSite=Strict`.
- [ ] Security, unchanged Origin check: a write request whose `Origin` is not `APP_ORIGIN` is still rejected.
- [ ] Security, no test data on the network:
  - the database container publishes its port on `127.0.0.1` only
  - the dev servers are not started with `--host`
  - the registered account uses throwaway credentials that are not reused anywhere
- [ ] Security, no secrets: none are used. The clone's `server/.env` comes from the example file and is never committed, pushed or copied into the working repository.
- [ ] Security, nothing published: nothing is pushed from the clone.
- [ ] Cleanup: the dev servers are stopped, the database container is removed, the temporary clone is deleted, and ports 4000, 5173 and 5432 are free again.
- [ ] A short verification report (commands run, results, any defects found) is appended under `## Comments` in this file.
