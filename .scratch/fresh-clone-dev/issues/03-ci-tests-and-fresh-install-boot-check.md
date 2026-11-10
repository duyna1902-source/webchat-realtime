# 03: CI: run the tests and boot the server from a clean install

**What to build:** Every push to `main`, and every pull request against `main`, runs a GitHub Actions workflow that installs from scratch, runs the full test suite, deletes the compiled shared output, boots the server with no database reachable, and passes only if the liveness endpoint answers `200`. This is the only check that runs under real fresh-clone conditions. See `.scratch/fresh-clone-dev/spec.md`, Implementation Decisions (CI, CI hardening) and Testing Decisions, Seam 2.

This ticket also confirms the spec's first open assumption: the server starts and answers liveness while its configured PostgreSQL is unreachable. If that is false, stop and report back instead of working around it.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A workflow runs on `push` to `main` and on `pull_request` against `main`, on Node 24.
- [ ] Steps, in order:
  - `npm ci`
  - `npm test`
  - delete the compiled shared output
  - start the server through `tsx` with `--conditions=@webchat/source` and without watch mode, in development mode, with a `DATABASE_URL` pointing at a host with nothing listening and `APP_ORIGIN=http://localhost:5173`
  - poll `/health` until `200`, failing after a timeout and printing the server output
  - stop the server
- [ ] The job fails if the server exits early, never answers, or logs `ERR_MODULE_NOT_FOUND`.
- [ ] Readiness (`/health/ready`) is not checked.
- [ ] Security: the workflow-level `permissions` are `contents: read` and nothing more.
- [ ] Security: no `pull_request_target` trigger, and no `secrets.*` or other secret is referenced.
- [ ] Security: the checkout step sets `persist-credentials: false`.
- [ ] Security: every third-party action is pinned to a full commit SHA, with its version in a trailing comment.
- [ ] Security: the throwaway environment values are clearly fake and contain nothing that looks like a credential, so the gitleaks pre-commit hook passes.
- [ ] The workflow passes on a pull request from this branch. It is shown to fail by temporarily removing the condition from the boot step on a throwaway commit that is not merged.
