# Spec: A Fresh Clone Runs in Development Without Building the Shared Package

Status: resolved

> Implemented on `fix/fresh-clone-dev` (2026-11-10). Tickets 01, 02, 04 and 05 are resolved. Ticket 03 is `ready-for-human`: its workflow still has to run on a real GitHub PR.

## Problem Statement

Someone who clones the repository and follows the README (`npm install`, then `npm run dev`, then registering at `http://localhost:5173`) gets `http proxy error: /api/auth/register` in the browser and cannot use the app at all.

The server crashes at startup with `ERR_MODULE_NOT_FOUND` for the shared package's compiled output. The shared contracts package is published to the other workspaces only as compiled output, which is gitignored, and nothing builds it before development starts. The Vite dev server then cannot reach the backend on port 4000 and reports a proxy error. That message says nothing about the real cause.

The defect is invisible to the people best placed to notice it:

- The maintainer's machine has compiled output left over from an earlier build, so development works there.
- Every test suite and the client's dev server read the shared package from its TypeScript source, so `npm test` passes on a fresh clone.
- The repository has no CI, so nothing ever runs the server from a clean checkout.

The server is the only consumer that reads the compiled output during development. That inconsistency is the root cause.

Two other common setup mistakes produce the same unhelpful browser message: a missing `server/.env`, and no reachable PostgreSQL database. The README offers no quick way to get a local database and no hint of what the proxy error means.

## Solution

During development, tests and operator commands, every consumer reads the shared contracts package from its TypeScript source. Only the production build and the production server use the compiled output.

- The shared package exposes its source entry point under a project-specific package export condition, `@webchat/source`.
- Every server command run through `tsx` opts into that condition.
- A fresh clone runs `npm run dev`, `npm run dev:server` and the operator commands without any build step.
- Edits to the shared package take effect without rebuilding it.

`npm install` still builds the shared package once. This exists only so the editor can show types for the server's imports of the shared package. The app never depends on it.

The README's Getting Started section gains copy-paste commands for creating `server/.env` and starting a local PostgreSQL container that matches the default `DATABASE_URL`. A Troubleshooting entry explains that `http proxy error: /api/...` means the backend on port 4000 is not running, and lists the usual causes.

A new GitHub Actions workflow runs the tests and then boots the server from a clean install with the compiled shared output deleted. A regression therefore fails a check instead of reaching the next person who clones the repository.

## User Stories

1. As a developer cloning the repository for the first time, I want `npm install` followed by `npm run dev` to start both the server and the client, so that I can use the app without knowing about the monorepo's internal build order.
2. As a developer cloning the repository for the first time, I want registering an account at `http://localhost:5173` to succeed once my database is set up, so that my first experience of the project is a working app, not a proxy error.
3. As a developer running only the backend, I want `npm run dev:server` to start on a fresh clone, so that I can work on the API without starting the client.
4. As an operator, I want the data upgrade command and the session revocation command to run on a fresh clone, so that maintenance work never fails for reasons unrelated to the database.
5. As a developer editing the shared contracts while `npm run dev` is running, I want the server to pick up my change on its next reload, so that I never debug against stale compiled output.
6. As a developer editing the shared contracts, I want no extra watcher process in the dev output, so that the console shows only the server and the client.
7. As a developer whose environment installs with lifecycle scripts disabled, I want the server to still start in development, so that a security-hardened install does not break the app.
8. As a developer opening the server code in an editor right after `npm install`, I want imports from the shared package to show their types, so that I do not see false errors on a clean checkout.
9. As a developer, I want the shared package's source condition to have a project-specific name, so that opting into it never switches third-party packages to their own development builds.
10. As a maintainer deploying to Render, I want the production build and the production server to keep using the compiled shared output, so that production behavior does not change.
11. As a maintainer, I want the production build command to stay as it is, so that this fix needs no change in the Render dashboard or in `render.yaml`.
12. As a developer new to the project, I want the README to give a single command that starts a local PostgreSQL matching the default `DATABASE_URL`, so that I do not have to work out database settings myself.
13. As a developer new to the project, I want the README to give the exact command that creates `server/.env` from the example file, so that I do not skip the step and meet a configuration error.
14. As a developer who sees `http proxy error: /api/...` in the Vite output, I want a Troubleshooting entry that says the backend on port 4000 is not running and points me to the `[SERVER]` log, so that I look in the right place.
15. As a developer reading that Troubleshooting entry, I want it to list the usual causes (a missing `server/.env`, PostgreSQL not running, or the server failing to start), so that I can fix the problem without asking anyone.
16. As a contributor adding a new server command that runs through `tsx`, I want to be told it must opt into the shared source condition, so that I do not reintroduce this crash.
17. As a contributor who forgets that opt-in on a new server command, I want `npm test` to fail and name the command, so that the mistake is caught on my machine before review.
18. As a contributor who removes the opt-in from an existing server command, I want `npm test` to fail, so that the regression never reaches a fresh clone.
19. As a maintainer, I want a test that starts the real server entrypoint exactly as the `dev` script does and waits for its health endpoint, so that "the dev server starts" is checked by a test and not just assumed.
20. As a maintainer, I want the existing entrypoint `.env` test to use the same source condition instead of its own temporary path-mapping workaround, so that one real mechanism is tested instead of two paths that can drift apart.
21. As a maintainer, I want a CI workflow on every push to and pull request against `main`, so that the repository finally has an automated check.
22. As a maintainer, I want that workflow to run the full test suite, so that ordinary regressions are caught too.
23. As a maintainer, I want that workflow to delete the compiled shared output after installing and then boot the server, so that the check proves development really does not depend on it, even though the install step builds it.
24. As a maintainer, I want the CI boot check to pass without a real database, so that the workflow stays fast and needs no database service.
25. As a maintainer, I want CI to run on the Node version the project is developed on, so that the check matches the environment people actually use.
26. As a future reader of the architecture decisions, I want the monorepo ADR to record that development reads the shared package from source while only production uses the compiled output, and why, so that the custom export condition does not look like an accident.
27. As a future reader, I want that record to say why the alternative (building the shared package automatically before development, plus a watcher) was rejected, so that nobody reintroduces it without knowing the trade-off.

## Implementation Decisions

- **The shared contracts package exposes its source.** Its package exports gain a `@webchat/source` condition that maps to the TypeScript entry point. It comes before the existing `types`, `import` and `default` conditions, so it wins whenever a consumer opts in, and is ignored otherwise. Consumers that do not opt in, such as the production server and TypeScript's own resolution, keep using the compiled output.
- **The condition name is namespaced on purpose.** A Node `--conditions` flag applies to every package in the process. A generic name such as `development` or `source` would also switch any third-party dependency that publishes a condition under that name.
- **Every server command run through `tsx` opts in.** These are the dev server, the data upgrade command and the session revocation command. The production start command (plain `node` on the server's compiled output) does not opt in.
- **The root install hook builds the shared package before generating the Prisma client.** It exists only for editor types: TypeScript finds the server's types for `@webchat/shared` through the package's `types` export. If the hook is skipped, the only effect is missing types in the editor.
- **No pre-dev build hook and no shared watcher process.** Reading from source makes both unnecessary.
- **The client and the test runners keep their existing source aliases for the shared package.** Moving them to the export condition would unify the mechanism, but they already work and are outside this defect.
- **Production is unchanged.** The root build still compiles the shared package, then the server, then the client. The Render build and start commands are unchanged.
- **README, Getting Started:** the environment step gains the literal copy command for `server/.env`. A PostgreSQL step gives a `docker run` command for `postgres:16` whose credentials, database name and port match the default `DATABASE_URL` in the example env file. The step that applies migrations stays as it is.
- **The local PostgreSQL command is safe to copy-paste.** It publishes the port on the loopback interface only (`127.0.0.1:5432`), never on every interface, because the example credentials are public. The README says those credentials are for local development only and must never be used for a deployed database.
- **README, Troubleshooting:** a new section explains the `http proxy error: /api/...` symptom and lists its usual causes.
- **README, contributor note:** server commands run through `tsx` must pass the `@webchat/source` condition. The same note belongs next to the condition in the shared package's manifest, if the manifest format allows a comment. Otherwise the README alone carries it.
- **CI:** a new GitHub Actions workflow triggered on push to `main` and on pull requests against `main`, running on Node 24. Steps:
  1. Clean install (`npm ci`).
  2. Full test suite.
  3. Delete the compiled shared output.
  4. Start the server through `tsx` with the source condition and without watch mode, using a minimal environment: development mode, a `DATABASE_URL` pointing at a host where nothing is listening, `APP_ORIGIN=http://localhost:5173`.
  5. Poll the liveness endpoint until it answers `200`, failing after a timeout.
  6. Stop the server.

  Readiness is not checked, because no database is reachable.
- **The CI workflow is hardened.** The repository is public, so the workflow follows least privilege:
  - The token is read-only for repository contents.
  - The workflow triggers on `pull_request`, never on `pull_request_target`.
  - The checkout does not keep credentials around for later steps.
  - The workflow uses no secrets.
  - Third-party actions are pinned to a full commit SHA, with the version in a comment.
- **ADR 0005 (monorepo and shared contracts):** its Consequences section gains a paragraph:
  - During development, tests and operator commands, every consumer reads the shared package from source.
  - Only the production build uses the compiled output.
  - The server opts in through the `@webchat/source` export condition.
  - Building automatically before development (with a watcher) was rejected because it leaves stale output, races with the server's reloader, adds a process, and breaks when lifecycle scripts are disabled.

  No new ADR: the decision is easy to reverse.
- **No glossary change.** This is build tooling and does not touch the domain language.

## Testing Decisions

- **What makes a good test here:**
  - It observes behavior a developer would see: the process starts and answers its health endpoint, or the shared package resolves to its source.
  - It does not assert on file contents such as the exact wording of a script.
  - It does not delete or modify files in the working copy.
- **Seam 1: the process seam inside `npm test`.** This is the existing server-side pattern of spawning the real entrypoint with `tsx` as a child process and polling its health endpoint. One new server test file covers two behaviors.
  - *Every `tsx` command resolves the shared package to source.*
    - The test finds every server package script that runs `tsx` and takes its arguments from the package manifest itself, so the test follows the scripts.
    - For each, it runs a child process with those arguments that reports where `@webchat/shared` resolves, and asserts the result is the shared package's TypeScript entry point, not the compiled output.
    - The check does not depend on whether compiled output exists, so the working copy never has to be modified.
    - When it fails, the message names the script.
    - It also fails when a new `tsx` script is added without the condition.
  - *The dev entrypoint starts.*
    - The test starts the server entrypoint with the `tsx` arguments of the server's `dev` script, without watch mode, using `NODE_ENV=test` and an in-memory database, on a free port.
    - It asserts the health endpoint answers `200`.
    - It fails with the captured server output if the process exits early.
- **Seam 1, changes to the existing entrypoint `.env` test.** That test drops its temporary path-mapping workaround and passes the source condition instead. Its own assertions about loading the `.env` file are unchanged.
- **Seam 2: the CI boot check** described in Implementation Decisions. It is the only check that runs under real fresh-clone conditions: a clean install with no compiled shared output and no database.
- **Prior art:** the existing entrypoint `.env` test (child process, free-port probe, health polling with an early-exit check and a deadline). The existing documentation test is prior art for tests that read repository files.
- **Not covered by automated tests:**
  - Whether the install hook builds the editor types (it affects only the editor).
  - The README wording.
  - Live pickup of shared source edits by the server's reloader. This is checked by hand during the verification below.
- **Manual verification before the pull request:**
  1. Delete the compiled shared output, run `npm run dev`, and check that the server logs that it is listening.
  2. Register an account through `http://localhost:5173` and check that it succeeds with no proxy error.
  3. While `npm run dev` is running, change an exported value in the shared package and check that the server reloads with it.
  4. Run `npm install` on a checkout with no compiled shared output, then check that the output exists and that the editor shows types for the server's imports.
  5. Run `npm test` and check that it passes.
  6. Clone into an empty directory, follow the README from the top, and check that it works.

## Out of Scope

- **The 12 vulnerabilities reported by `npm audit`.** None of them causes or blocks this defect. They have their own spec in `.scratch/dependency-vulnerabilities/`, to be triaged later.
- **Moving the client and the test runners from source aliases to the export condition.**
- **Changing the production build.**
- **Running CI against PostgreSQL, a Node version matrix, or the client in CI.**
- **Making the server start without `server/.env`, or without a database, in development.** These are now documented, not changed.

## Further Notes

- **Verified during design:** with the condition added and the compiled shared output removed, `tsx --conditions=@webchat/source` resolved `@webchat/shared` and loaded the server's error module, which imports it. Without the flag, the same command failed with `Cannot find module`. The server's TypeScript path mapping did not interfere, but only because that output was missing.
- **Found during implementation (ticket 01):** when the compiled shared output exists, `tsx` applies the `paths` mapping in the server's `tsconfig.json` (`@webchat/shared` to `../shared/dist/index.d.ts`) ahead of the export condition, so the dev server ran the compiled output. That mapping is removed. TypeScript resolves the types through the package's `types` export instead, and `tsc --noEmit` and `npm run build` still pass.
- **Assumptions to confirm during implementation; stop and report if either is false:**
  - The server starts and answers its liveness endpoint while the configured PostgreSQL is unreachable. The fresh-clone session observed it listening without a database.
  - `tsx` watch mode reloads when a shared source file that was resolved through the condition changes.
- **Origin:** a fresh-clone test session on 2026-11-10 reproduced the defect on `main` at `6a6419c` (Windows 11, Node 24.19.0, npm 11.17.0).
