# Spec: Vite Dev Server Fails Loudly When Port 5173 Is Busy

Status: needs-triage

> Captured on 2026-11-10 during `.scratch/fresh-clone-dev/` ticket 05 (end-to-end fresh-clone verification). Outside that spec's scope. Nothing has been changed yet.

## Problem Statement

When port 5173 is already in use, for example by another checkout's `npm run dev`, Vite moves to the next free port (5174) without failing. The client then runs at `http://localhost:5174`, but the server's `APP_ORIGIN` is still `http://localhost:5173`. The Origin check refuses every write request: register, login, sending messages. Nothing in the console points at the cause.

## Proposed Solution

- Set `server.strictPort: true` in `client/vite.config.ts`, so Vite exits with an error when 5173 is busy instead of moving to another port.
- Optionally, add a README Troubleshooting line: "Port 5173 is already in use" means another dev server is running. Stop it; do not change `APP_ORIGIN` to work around it.

## Out of Scope

- Making `APP_ORIGIN` follow whatever port Vite picks. That would weaken the Origin check.
