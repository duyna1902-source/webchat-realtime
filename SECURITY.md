# Security Policy

GDG-HUST Realtime Chat is a community project run by volunteers. We take reports seriously and fix confirmed vulnerabilities as fast as we can. This page says what is in scope, how to report privately, how fast we answer, and which risks we have knowingly accepted.

## Scope

In scope:

- The production deployment at `https://webchat-realtime.onrender.com`: the SPA, the REST API (`/api/*`), the Socket.IO endpoint (`/socket.io`) and the health endpoints (`/health`, `/health/ready`).
- The code on the `main` branch of this repository: `server/`, `client/`, `shared/`, the database migrations in `server/prisma/migrations/`, and the deploy blueprint `render.yaml`.
- Secrets that leak through this repository, its history or the running app.

Out of scope:

- Vulnerabilities in Render, Supabase, Giphy or GitHub themselves. Report those to the vendor.
- Volumetric denial of service (flooding the free-tier host), spam, and social engineering of maintainers or users.
- The risks listed under [Accepted risks](#accepted-risks), unless you find a way to exploit them beyond what is described there.
- Findings that need physical access to a user's device or a compromised browser extension.

When you test, use accounts you created yourself. Do not read, change or delete other users' messages, Attachments or accounts, and stop as soon as you can show the problem. Do not run automated scanners against production at a rate that degrades it for other users: the server is a single free-tier instance.

## Reporting a vulnerability

Report privately through **GitHub Private Vulnerability Reporting**: open the repository's **Security** tab and choose **Report a vulnerability** (direct link: <https://github.com/duyna1902-source/webchat-realtime/security/advisories/new>). Only the maintainers see the report.

> TODO(ticket 05): Private vulnerability reporting is switched on in the repository settings by ticket 05. Until a maintainer confirms it here, the link above may return 404.

Please **do not** open a public issue, pull request or discussion for a vulnerability, and do not post it in community chat groups.

A useful report contains:

- What an attacker can do, and what they need first (an account, a Room Member role, a leaked key...).
- Steps to reproduce, ideally a `curl` command or a short script.
- The `requestId` from the error response or the `X-Request-Id` response header, if you saw one. It lets us find your request in the server log.

## What happens next

| Step | Target time |
|---|---|
| We acknowledge your report | within 3 days |
| We confirm or reject it, with a first severity assessment | within 7 days |
| A fix for a Critical or High issue is deployed | within 14 days of confirmation |
| A fix for a Medium or Low issue is deployed | within 60 days of confirmation |
| Public disclosure (GitHub Security Advisory) | after the fix is deployed, at most 90 days after the report, agreed with you |

These are targets for a volunteer-run project, not guarantees. If we cannot meet one, we tell you why and when to expect an answer. We credit reporters in the advisory unless you ask us not to.

How the maintainers handle a confirmed incident is described in the [incident runbook](docs/incident-runbook.md).

## Security model in short

- **Single host, one origin** ([ADR 0010](docs/adr/0010-single-host-render-with-session-cookie.md)). Render serves the SPA, the API and Socket.IO from one origin, so there is no CORS. Every response carries a strict Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff` and a `Referrer-Policy`.
- **Server-side Sessions.** A Session is a row in the database. The browser holds its random token only in the `__Host-session` cookie (`HttpOnly; Secure; SameSite=Strict`), and the database stores only the token's SHA-256 hash. Sessions expire after 7 days idle or 30 days at most, and can be revoked: by the user ("Sign out of all devices") or by an operator (`sessions:revoke`, see the runbook).
- **CSRF and cross-site WebSockets.** Every `POST`, `PATCH`, `PUT` and `DELETE` and every Socket.IO handshake must come from `APP_ORIGIN`.
- **Private Attachments** ([ADR 0009](docs/adr/0009-private-attachments-via-records-and-signed-urls.md)). An upload becomes an Attachment record. The file type is detected from its content, image metadata (EXIF) is stripped, and the file lives in a private bucket. Only the Direct Chat Participants or the current Room Members get a signed URL, valid for 1 hour.
- **Input validation, rate limits and structured security logs** on every REST endpoint and socket event. Errors show users only a generic message and a `requestId`.
- **No secrets in the repository.** `render.yaml` holds no secret values, and a `gitleaks` pre-commit hook blocks commits that contain one (see [Secret scanning](README.md#secret-scanning)).

## Accepted risks

We know about these and have decided to accept them for now. Reports that only restate them are out of scope.

1. **Tailwind CSS v3 build-time advisories.** `npm audit` reports DoS advisories (stack exhaustion, quadratic complexity) in `braces`, `micromatch`, `fast-glob`, `chokidar`, `postcss-nested` and `postcss-selector-parser`, all pulled in by `tailwindcss` 3.4.19. They only matter **at build time**, their input is the project's own source and CSS, and they are devDependencies that never ship. Tailwind 3.4.19 is the latest `v3-lts` release; the only fix is Tailwind 4, a breaking upgrade tracked as separate work.
2. **Vitest 2 advisories.** `vitest`, `@vitest/mocker`, `vite-node`, the `vite` and `esbuild` copies nested in them, and `tinypool` (rated critical) have advisories. They only run when the test suite runs, against the project's own tests, and never ship. The fix is Vitest 5, a breaking upgrade that is a follow-up task. The production dependency tree is clean: `npm audit --omit=dev` must report 0 vulnerabilities, and we re-check it before each release.
3. **In-memory rate limits.** Rate-limit counters live in the memory of the single Render instance. A restart or deploy resets them, and they would not hold across several instances. Moving them to a shared store is required before the app ever scales horizontally.
4. **Render free-tier cold start.** The free instance sleeps after 15 minutes without traffic, so the first visit afterwards shows a blank page for 30–50 seconds. An optional uptime monitor that pings `/health` avoids it (see the runbook).
5. **A signed Attachment URL stays valid for up to 1 hour after access is lost** ([ADR 0009](docs/adr/0009-private-attachments-via-records-and-signed-urls.md)). A Room Member who leaves or is kicked loses real-time access at once, but a signed URL they already received keeps working until it expires. This is the price of serving files straight from storage instead of proxying every byte through the server.
6. **Data from before the security upgrade may have been read or planted.** Until the 2026-10 security upgrade, a Supabase `service_role` key was public in this repository, and the database tables were reachable through Supabase's Data API without Row Level Security. Anyone could have read every message, password hash and Attachment, or inserted rows such as accounts. The leaked keys are deactivated, Row Level Security is on for every table, and the data upgrade command normalizes the existing data, but it cannot tell rows a stranger inserted from real ones. We accept this because production held no real users' data at that time. See the [SEC-01 example in the runbook](docs/incident-runbook.md#example-sec-01-secrets-committed-to-the-public-repository).
   > TODO(ticket 05): record the date the leaked Supabase keys were deactivated and the result of the Supabase log review for use of the `service_role` key.
7. **Operator revocations reach open sockets within about 60 seconds.** Signing out, or "Sign out of all devices", cuts off sockets at once. A revocation made with the `sessions:revoke` command runs in another process, so the server only notices it at its next Session re-check, up to about 60 seconds later. REST requests with a revoked Session fail immediately.
8. **No password change or reset.** The app sends no email and has no password change feature. A user who suspects their account is compromised can only use "Sign out of all devices", or ask a maintainer to revoke their Sessions.
