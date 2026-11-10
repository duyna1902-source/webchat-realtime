# 03: CI: run the tests and boot the server from a clean install

**What to build:** Every push to `main`, and every pull request against `main`, runs a GitHub Actions workflow that installs from scratch, runs the full test suite, deletes the compiled shared output, boots the server with no database reachable, and passes only if the liveness endpoint answers `200`. This is the only check that runs under real fresh-clone conditions. See `.scratch/fresh-clone-dev/spec.md`, Implementation Decisions (CI, CI hardening) and Testing Decisions, Seam 2.

This ticket also confirms the spec's first open assumption: the server starts and answers liveness while its configured PostgreSQL is unreachable. If that is false, stop and report back instead of working around it.

**Blocked by:** 01

**Status:** resolved

- [x] A workflow runs on `push` to `main` and on `pull_request` against `main`, on Node 24.
- [x] Steps, in order:
  - `npm ci`
  - `npm test`
  - delete the compiled shared output
  - start the server through `tsx` with `--conditions=@webchat/source` and without watch mode, in development mode, with a `DATABASE_URL` pointing at a host with nothing listening and `APP_ORIGIN=http://localhost:5173`
  - poll `/health` until `200`, failing after a timeout and printing the server output
  - stop the server
- [x] The job fails if the server exits early, never answers, or logs `ERR_MODULE_NOT_FOUND`.
- [x] Readiness (`/health/ready`) is not checked.
- [x] Security: the workflow-level `permissions` are `contents: read` and nothing more.
- [x] Security: no `pull_request_target` trigger, and no `secrets.*` or other secret is referenced.
- [x] Security: the checkout step sets `persist-credentials: false`.
- [x] Security: every third-party action is pinned to a full commit SHA, with its version in a trailing comment.
- [x] Security: the throwaway environment values are clearly fake and contain nothing that looks like a credential, so the gitleaks pre-commit hook passes.
  - The values are fake and hold no credential. `DATABASE_URL` is `postgresql://127.0.0.1:1/ci_no_database`, with no user or password. With gitleaks 8.30.1 installed and `core.hooksPath` set to `.githooks`, `gitleaks dir .github` and `gitleaks git .` (full history) both report no leaks. The commit that resolves this ticket went through the pre-commit hook.
- [x] The workflow passes on a pull request from this branch. It is shown to fail by temporarily removing the condition from the boot step on a throwaway commit that is not merged.
  - Pass: the branch was merged straight into `main` rather than through a PR, so the passing run is the `push` run on `main` at `6e8b398` ([run 42812196113](https://github.com/duyna1902-source/webchat-realtime/actions/runs/42812196113)). Every step passed, including the boot step.
  - Fail: PR #5 from `throwaway/ci-drop-source-condition` (`2f7c219`, `--conditions=@webchat/source` removed from the boot step) ran the workflow on `pull_request` ([run 42819538360](https://github.com/duyna1902-source/webchat-realtime/actions/runs/42819538360)). Install, Test and the shared-output deletion passed, then the boot step failed with `The server exited before /health answered 200`. The PR was closed unmerged and the branch deleted.

## Verification (local simulation of the workflow)

Run on Windows 11, Node 24.19.0, npm 11.17.0, in Git Bash, on 2026-11-10. A throwaway script ran the workflow's steps in order: `npm ci`, `npm test`, `rm -rf shared/dist`, then the boot step. It extracted the boot step's script from `.github/workflows/ci.yml` word for word, and used the workflow's env values. The one exception was `PORT`. It was 4573 locally, because other worktrees on the machine may use 4000. Nothing was listening on port 1.

- **Pass:** a fresh `npm ci` (566 packages) succeeded. `npm test` passed: server 417 tests and client 205 tests. `shared/dist` was deleted. The server logged `Server listening` and `/health` answered `200` with PostgreSQL unreachable, which confirms the spec's first assumption. The server was stopped, and no listener was left behind.
- **Fail:** the same boot script was run with `--conditions=@webchat/source` stripped, locally only, with no commit. The step failed with `The server exited before /health answered 200`. It printed the server output, which showed `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/node_modules/@webchat/shared/dist/index.js' imported from …/server/src/lib/errors.ts`.
- **Guard:** the boot step fails before it starts the server if something already answers on the port. Without this guard, a server left over from another process could make the check pass. When it was tested locally against a dummy listener, the step failed as intended.
- Actions are pinned from `git ls-remote` of the official repos. Both tags are lightweight, so no dereferencing was needed. `actions/checkout` v7.0.1 is `3d3c42e5aac5ba805825da76410c181273ba90b1`, and `actions/setup-node` v7.1.0 is `949feb2413d6458794dcd2491c4babbbce0c15c1`.

## Comments

- 2026-11-10: The workflow is merged on `fix/fresh-clone-dev`, and the local simulation of its steps passes (and fails as expected without the condition). Left for the maintainer (ready-for-human): push the branch, open a PR against `main`, confirm the workflow passes there, and show it fails on a throwaway commit with the condition removed from the boot step. The gitleaks criterion could not run because no gitleaks hook is installed in this checkout.
- 2026-11-10: Ran on GitHub. The workflow passed on `main` (push) and failed as expected on throwaway PR #5 with the condition removed (see the criterion above). Only the gitleaks criterion is still open: it needs gitleaks installed and the hook enabled. The status stays ready-for-human until then.
- 2026-11-10: Installed gitleaks 8.30.1 and enabled the hook. The workflow file and the full git history scan clean. The ticket is resolved.
