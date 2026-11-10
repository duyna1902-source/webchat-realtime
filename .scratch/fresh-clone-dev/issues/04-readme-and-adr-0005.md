# 04: Document local setup, troubleshooting, and the shared source decision

**What to build:** A newcomer reading the README can do the following without asking anyone:
- create `server/.env`
- start a local PostgreSQL that matches the default `DATABASE_URL`
- understand what `http proxy error: /api/...` means
- know that any new server `tsx` command must opt into `@webchat/source`

ADR 0005 records that development reads the shared package from source while only production uses the compiled output, and why the build-before-dev alternative was rejected. See `.scratch/fresh-clone-dev/spec.md`, Implementation Decisions (README items and ADR 0005).

**Blocked by:** 01

**Status:** resolved

- [x] Getting Started, environment step: gives the literal command that copies the example env file to `server/.env`.
- [x] Getting Started, a PostgreSQL step: gives a `docker run` command for `postgres:16` whose user, password, database name and port match the default `DATABASE_URL` in the example env file.
- [x] Security: that command publishes the port on `127.0.0.1` only (`-p 127.0.0.1:5432:5432`), never on all interfaces.
- [x] Security: the README says the example credentials are public, for local development only, and must never be used for a deployed or shared database.
- [x] A Troubleshooting section says `http proxy error: /api/...` means the backend on port 4000 is not running, tells the reader to check the `[SERVER]` log, and lists the usual causes: missing `server/.env`, PostgreSQL not running, or the server failing to start.
- [x] A contributor note says server commands run through `tsx` must pass `--conditions=@webchat/source`, and that `npm test` enforces it.
- [x] Security: the Troubleshooting text never tells the reader to work around the Origin check, for example by opening the app on port 4000 or changing `APP_ORIGIN` to something other than the origin they actually use.
- [x] ADR 0005's Consequences gain a paragraph:
  - What it records: source in development, tests and operator commands; compiled output only in production; the server opts in through `@webchat/source`; the editor-types install build.
  - Why the build-before-dev and watcher alternative was rejected: stale output, a race with the reloader, an extra process, and breakage with lifecycle scripts disabled.
  - It is written in the ADR's existing language (Vietnamese).
- [x] The glossary is not changed.
- [x] The existing documentation test still passes, and `npm test` passes.

## Comments

- 2026-11-10: Resolved on `fix/fresh-clone-dev`. After code review, the rejected build-before-dev alternative moved to ADR 0005's Considered Options.
