# Incident runbook

What the maintainers do when a security incident happens: a leaked key, a compromised account, abuse, or a vulnerability report through [`SECURITY.md`](../SECURITY.md). Follow the sections in order; skip the ones that do not apply. The last section applies the whole runbook to SEC-01, the incident that started the 2026-10 security upgrade.

Where things live:

| What | Where |
|---|---|
| App, API and Socket.IO (single host, [ADR 0010](adr/0010-single-host-render-with-session-cookie.md)) | Render web service `webchat-realtime`, `https://webchat-realtime.onrender.com` |
| Application log | Render dashboard → the service → **Logs** |
| Server secrets (`DATABASE_URL`, `SUPABASE_SECRET_KEY`, `GIPHY_API_KEY`) | Render dashboard → the service → **Environment**. Never in `render.yaml`, which is public. |
| Database (Postgres) and Attachment bucket `attachments` | Supabase project, dashboard → **Database**, **Storage**, **Logs** |
| Vulnerability reports, secret scanning alerts | GitHub repository → **Security** |
| Migration and data upgrade commands | [`database-migrations.md`](database-migrations.md) |

Ground rules:

- **Write things down as you go.** Open an incident ticket under `.scratch/` (see [`agents/issue-tracker.md`](agents/issue-tracker.md)) and keep a timeline: what you saw, what you did, when. Never paste a secret, a Session cookie or a password into it.
- **Back up before any data operation.** Run [`pg_dump`](#back-up-the-database-before-any-data-operation) before you run a migration, the data upgrade command or any SQL that changes data.
- **Contain first, investigate second.** Rotating a key or revoking Sessions is cheap and reversible for users (they sign in again); a leaked key that stays valid is not.
- The Render free plan has no Shell. Operator commands run from your own checkout, with the production connection string set **only in your shell for that one command**, never written into `server/.env`.

## 1. Detect: read the application log

The server writes one JSON line per log entry (pino) to stdout, and Render shows them under **Logs**. Every line has `level`, `time` and `msg`. Lines from a request or socket also carry `requestId`, `ip` (the real client IP, behind Render's proxy) and, once the user is authenticated, `userId`. Passwords, cookies, Session tokens and any key containing `secret` or `token` are replaced by `[Redacted]` before a line is written.

pino levels: `30` info, `40` warn, `50` error, `60` fatal.

### Security events

Security-relevant actions are logged with their name in the `event` field (`server/src/lib/security-events.ts`). Search the Render log for `"event":"<name>"`.

| `event` | Level | Extra fields | What to look for |
|---|---|---|---|
| `auth.login.success` | info | `userId` | Logins to one account from many IPs, or at odd hours. |
| `auth.login.failure` | warn | `identifier` (normalized), `reason` (`unknown_user` or `wrong_password`), `userId` when the user exists | Many failures from one `ip` (password guessing) or against one `identifier` (targeted attack). |
| `auth.register` | info | `userId` | Bursts of new accounts (bots). |
| `auth.logout` | info | `userId` | |
| `auth.logout_all` | info | `userId`, `revoked` | A user who signed out of all devices may think their account was compromised. |
| `session.revoked` | info | `scope` (`session`, `user` or `all`), `userId`, `count` | Every revocation, by the server or by the `sessions:revoke` command. The Session id is never logged. |
| `ratelimit.hit` | warn | `limit` (which limit), `retryAfterMs` | Repeated hits from one `ip` or `userId`: brute force, scraping or spam. |
| `upload.accepted` | info | `attachmentId`, `kind`, `mimeType`, `size` | Unusual upload volume from one user. |
| `upload.rejected` | warn | `reason` (`unsupported_type`, `too_large`, `invalid_request`, `no_file`), `declaredType`, `size` | Someone probing the upload filter with HTML, SVG or executables. |
| `room.member.kicked` | info | `roomId`, `targetUserId`, `targetRole` | Moderation actions, for example after a takeover of an OWNER or ADMIN account. |
| `room.member.role_changed` | info | `roomId`, `targetUserId`, `fromRole`, `toRole` | Unexpected promotions to `ADMIN`. |
| `room.deleted` | info | `roomId` | |
| `room.left` | info | `roomId`, `role` | |
| `http.401` | warn | `method`, `path` | Requests without a valid Session: expired cookies, or scanning. |
| `http.403` | warn | `method`, `path` | Cross-site writes refused by the `Origin` check (CSRF attempts), or forbidden actions. |
| `socket.handshake.rejected` | warn | `reason` (`forbidden_origin`, `no_session`, `error`), `origin`, `ip` | `forbidden_origin` means a socket from another site (Cross-Site WebSocket Hijacking attempt). |

### Errors and the user's reference code

An unexpected error shows the user only a generic message and a `requestId`, which is also in the `X-Request-Id` response header. The same `requestId` is on the log line with the full error and stack:

- `"msg":"Request failed"` (level 50): a REST request answered with a 5xx.
- `"msg":"Socket event failed"` (level 50): a socket event handler failed.
- `"msg":"Unhandled promise rejection"` or `"msg":"Uncaught exception"` (level 60): the last-resort safety net. Any of these is a bug to fix.

When a user reports a problem with a reference code, search the log for that `requestId`.

### Health endpoints

| Endpoint | Answers | Use |
|---|---|---|
| `GET /health` | `200 {"status":"ok"}` whenever the process is up | Liveness. Render's health check (`healthCheckPath` in `render.yaml`) and the optional uptime monitor use it. |
| `GET /health/ready` | `200 {"status":"ready"}` when the database answers `SELECT 1`, otherwise `503 {"status":"unavailable"}` | Readiness. The cause of a `503` is only in the log, as `"msg":"Readiness check failed: database unreachable"`. |

Render keeps checking `/health`, not `/health/ready`, on purpose: when Supabase is down or paused, restarting the web service does not help, and a failing readiness check would also block deploys. Check `/health/ready` by hand, or point a monitor at it, to tell "the app is down" from "the database is down".

## 2. Contain: rotate keys

Rotate every key that may have leaked, and only then look for how it was used. Rotating a key does not end user Sessions; [revoke them](#3-contain-revoke-sessions) separately if accounts may be compromised.

### Supabase secret key (`SUPABASE_SECRET_KEY`)

The server uses one Supabase **secret key** (`sb_secret_...`), sent only in the `apikey` header to the Storage API. It must never be one of the legacy JWT keys (`anon`, `service_role`).

1. Supabase dashboard → **Project Settings** → **API Keys** → create a new secret key. Copy it straight into the next step; do not save it anywhere else.
2. Render dashboard → the service → **Environment** → set `SUPABASE_SECRET_KEY` to the new key → **Save changes**. Render redeploys the service.
3. Wait until the deploy is live, then check that uploads still work: sign in, send an image in a Direct Chat, and confirm it displays.
4. Back in Supabase, delete the old secret key. From now on a leaked copy is useless.
5. If the legacy `anon` and `service_role` keys are still active, disable them (**API Keys** → **Legacy API keys**). The app does not use them.
6. Confirm the Data API exposes nothing: `GET <SUPABASE_URL>/rest/v1/User` with the new key in the `apikey` header must return an error or an empty list. If it returns rows, turn the Data API off (**Project Settings** → **Data API**), or remove `public` from the exposed schemas.

> TODO(ticket 05): replace the dashboard paths above with the exact ones used when the leaked keys were rotated, and note whether the Data API could be switched off completely or only had `public` removed from its exposed schemas.

### Database password (`DATABASE_URL`)

If the connection string may have leaked (it contains the database password):

1. Supabase dashboard → **Project Settings** → **Database** → reset the database password.
2. Build the new `DATABASE_URL`. Use the **direct** connection or the **session-mode** pooler. Do not use the transaction pooler on port `6543`: `prisma migrate deploy` fails through it, and the Render start command runs `migrate deploy` before the server starts.
3. Render → **Environment** → set `DATABASE_URL` → **Save changes**, and wait for the deploy.
4. Check `GET /health/ready` returns `200`.

### Other keys

- `GIPHY_API_KEY`: create a new key in the Giphy developer dashboard, set it on Render, delete the old one. Without a key the app falls back to built-in GIFs, so you can also just delete the variable.
- `JWT_SECRET`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: the app no longer reads them. If any of them is still set on Render, delete it, and treat its value as compromised.

### Render environment checklist

`render.yaml` declares the secrets with `sync: false`. Render asks for those values only when a blueprint is first created, so on the **existing** service every change below is made by hand in **Environment**:

- [ ] `SUPABASE_SECRET_KEY`, `SUPABASE_URL`, `DATABASE_URL` and `GIPHY_API_KEY` have values.
- [ ] `APP_ORIGIN` is `https://webchat-realtime.onrender.com` (no trailing slash). The server refuses to start without it, and checks every write and socket handshake against it.
- [ ] `NODE_ENV=production`, `STORAGE_PROVIDER=supabase`, `SUPABASE_STORAGE_BUCKET=attachments`, `PORT=10000`.
- [ ] `JWT_SECRET`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are deleted.

If a variable is missing or invalid, the server exits at startup and the deploy log lists **every** bad variable. It never falls back to a default secret.

## 3. Contain: revoke Sessions

A Session is a row in the `Session` table. Revoking it deletes the row: the next REST request with that cookie gets `401`, and the browser returns to the sign-in screen.

- **One user, by themselves:** the **Sign out of all devices** button revokes every Session of that user. Their open sockets are cut off at once.
- **One user, by an operator:**
  ```bash
  npm run sessions:revoke --workspace=server -- --user <username or id>
  ```
  The username must match exactly (case included), or use the user id.
- **Everybody** (for example after a key that could forge or read Sessions leaked):
  ```bash
  npm run sessions:revoke --workspace=server -- --all
  ```

Run the command from the repository root of an up-to-date checkout, after `npm install`. It loads the normal server configuration, so it needs `DATABASE_URL` and `APP_ORIGIN`. Set them in the shell for this one command, so the production connection string never lands in a file:

```bash
# bash
DATABASE_URL='postgresql://...' APP_ORIGIN='https://webchat-realtime.onrender.com' \
  npm run sessions:revoke --workspace=server -- --all
```

```powershell
# PowerShell
$env:DATABASE_URL = 'postgresql://...'; $env:APP_ORIGIN = 'https://webchat-realtime.onrender.com'
npm run sessions:revoke --workspace=server -- --all
Remove-Item Env:DATABASE_URL, Env:APP_ORIGIN
```

Leave `NODE_ENV` unset: with `NODE_ENV=production` the configuration also demands the Supabase variables and a client build. Variables set in the shell win over `server/.env`.

`npm run sessions:revoke` runs the TypeScript source through `tsx`, a devDependency. On a machine with only a build, run the compiled command from `server/` instead: `npm run build`, then `node dist/cli/revoke-sessions.js --all` (or `--user <username or id>`).

What to expect:

- It prints `Revoked <n> sessions of all users.` or `Revoked <n> sessions of user <username> (<id>).`, and an unknown user is an error that revokes nothing.
- It writes its `session.revoked` event to **your terminal**, not to the Render log. Copy that line into the incident ticket.
- REST requests with a revoked Session fail at once. **Open sockets are cut off within about 60 seconds**: the command runs outside the server process, so the server only notices at its next Session re-check (`timing.sessionRecheckIntervalMs`, 60 s by default). Each affected socket receives `session:ended` and is disconnected. Revocations made inside the server (sign out, sign out of all devices) need no re-check.
- Afterwards, search the Render log for `"event":"http.401"` and `"event":"socket.handshake.rejected"` with `"reason":"no_session"`: the revoked browsers show up there as they try again.

The app has no password reset (decision Q28). If an account's password may be known to an attacker, revoking its Sessions does not stop them from signing in again; there is no in-app fix yet, so tell the user and, if needed, rename or remove the account directly in the database after a backup.

## 4. Assess the impact

Answer three questions: what could the attacker reach, since when, and did they use it. Export the logs you need first: log retention on the free plans of Render and Supabase is short.

1. **Exposure window.** When did the secret leak (for example the first commit that contained it: `git log --all -S '<a unique part of the key>'`) and when did you rotate it?
2. **Application log** (Render). For the window, look for:
   - `auth.login.success` for accounts the owner did not use, and `auth.login.failure` bursts before them.
   - `auth.register` of accounts nobody recognizes.
   - `room.member.role_changed`, `room.member.kicked`, `room.deleted` that the room's owner did not do.
   - `upload.accepted` from unexpected users, and `upload.rejected` probing.
   - Errors with level 50 or 60 around the same time.
3. **Supabase logs** (dashboard → **Logs**). For the window, look at:
   - **API gateway** and **PostgREST** logs: any request to `/rest/v1/` is suspicious, because the app never uses the Data API. Note the IPs, user agents and the key role used (`anon`, `service_role` or a secret key).
   - **Storage** logs: uploads, downloads, deletions and listings that did not come from the app's key.
   - **Postgres** logs: connections from unexpected IPs or roles.
4. **Database contents**, read-only:
   - Accounts created in the window: `SELECT id, username, "createdAt" FROM "User" WHERE "createdAt" BETWEEN '<start>' AND '<end>' ORDER BY "createdAt";`
   - Sessions created in the window: `SELECT "userId", "createdAt", ip, "userAgent" FROM "Session" WHERE "createdAt" BETWEEN '<start>' AND '<end>';`
   - Objects in the `attachments` bucket that no Attachment references. The data upgrade command lists and deletes them; run it with `--dry-run` first to only see the list (see [the data upgrade command](#data-upgrade-command)).
5. **Decide what was exposed:** messages, password hashes (bcrypt), emails, Attachments. Write the answer in the incident ticket; it is the input to the next section.

## 5. Notify users

Notify when real users' data may have been read or changed, or when they must act (sign in again, check their account). Do it as soon as the leak is contained, even if the investigation is not finished; send an update when it is.

The app sends no email. Post the notice where the users are: the GDG-HUST community channels where the app is announced, and pinned in a Room every user is in, if there is one.

Say:

- What happened and when, in plain words.
- Which data may be affected, and what is known **not** to be affected.
- What we did: keys rotated, Sessions revoked, the fix deployed.
- What users should do: sign in again; use **Sign out of all devices** if they see activity they do not recognize; change the password **on other sites** where they reused it (passwords are stored as bcrypt hashes, but a weak password can still be guessed from a leaked hash).
- How to reach the maintainers, and how to report a vulnerability ([`SECURITY.md`](../SECURITY.md)).

Template (the app's users are Vietnamese):

> **[GDG-HUST Realtime Chat] Thông báo sự cố bảo mật**
>
> Ngày `<ngày>`, chúng tôi phát hiện `<mô tả ngắn sự cố>`. Dữ liệu có thể bị ảnh hưởng: `<tin nhắn / email / tệp đính kèm / mật khẩu đã băm>`, trong khoảng thời gian `<từ ... đến ...>`.
>
> Chúng tôi đã `<xoay vòng key / đăng xuất mọi phiên đăng nhập / vá lỗi>`. Bạn cần đăng nhập lại. Nếu thấy hoạt động lạ trong tài khoản, hãy dùng nút "Sign out of all devices". Nếu bạn dùng cùng mật khẩu này ở trang web khác, hãy đổi mật khẩu ở đó.
>
> Mọi câu hỏi xin liên hệ `<kênh liên hệ>`.

If no real user is affected (for example, test data only), record that decision and the reason in the incident ticket instead.

## Back up the database before any data operation

Take a dump before running migrations, the data upgrade command, or any SQL that changes data:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --file="webchat-$(date +%Y%m%d-%H%M%S).dump"
pg_restore --list webchat-<timestamp>.dump > /dev/null && echo "dump is readable"
```

- Use a `pg_dump` whose major version is the same as or newer than the server's (`SELECT version();`).
- Use the direct connection or the session-mode pooler, not the transaction pooler on port `6543`.
- Keep the dump **outside the repository** and outside any synced public folder. It contains password hashes and every message. Delete it when it is no longer needed.
- To restore into an empty database: `pg_restore --no-owner --no-privileges --dbname="$DATABASE_URL" webchat-<timestamp>.dump`.

### Data upgrade command

The data upgrade command normalizes existing data to the current rules. It is documented in [`database-migrations.md`](database-migrations.md#the-data-upgrade-command). Against production, always back up first, then:

```bash
npm run db:upgrade-data --workspace=server -- --dry-run   # report only, changes nothing
npm run db:upgrade-data --workspace=server                # apply
```

It loads the normal server configuration, so set `DATABASE_URL` and `APP_ORIGIN` in the shell as for [`sessions:revoke`](#3-contain-revoke-sessions). To include the bucket, also set `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SUPABASE_STORAGE_BUCKET`. Save the report of both runs in the incident ticket.

> TODO(ticket 14): describe the legacy Attachment steps (turning old bucket URLs into Attachment records, removing unsafe attachments, deleting unreferenced bucket objects): which step names appear in the report, what their counts mean, and which storage variables they need.

## Supabase free plan pauses inactive projects

Supabase pauses a free-plan project after about a week without activity. The app then stays up but cannot reach its database:

- `GET /health` still answers `200`, but `GET /health/ready` answers `503`, and the log shows `"msg":"Readiness check failed: database unreachable"`.
- Sign-in and every API call fail with a generic error; the log has `"msg":"Request failed"` lines.
- A deploy fails at the start command, because `prisma migrate deploy` cannot connect.

To recover, open the project in the Supabase dashboard and restore (unpause) it. That can take a few minutes; then check `/health/ready` again. No data is lost by a pause, but take a [backup](#back-up-the-database-before-any-data-operation) once it is back if the last one is old.

## Optional: uptime monitor against cold starts

The Render free instance sleeps after 15 minutes without traffic, and the next visitor waits 30–50 seconds on a blank page (accepted in [ADR 0010](adr/0010-single-host-render-with-session-cookie.md) and in [`SECURITY.md`](../SECURITY.md#accepted-risks)). If that matters, set up a free uptime monitor (for example UptimeRobot) that requests `https://webchat-realtime.onrender.com/health` every 5–10 minutes.

- One always-on free instance uses about 750 instance hours a month, which is the free plan's monthly allowance, so do not do this for more than one free service.
- A monitor on `/health/ready` instead also queries the database, which tells you when Supabase is paused or down. It is a convenience, not a guarantee against the pause.
- It is optional. The project uses no paid monitoring.

## Example: SEC-01, secrets committed to the public repository

SEC-01 of the [security audit](../.scratch/security-audit/spec.md) (2026-10-22): `render.yaml` in this **public** repository held the production `JWT_SECRET`, `SUPABASE_URL`, and the Supabase legacy `anon` and `service_role` keys as plain values, since commit `25121a1`. The `service_role` key bypasses Row Level Security, and the tables had no RLS and were exposed through the Data API, so anyone could read and write every table and every object in the bucket. The `JWT_SECRET` let anyone sign a token for any user. Here is how this runbook applies to it.

**1. Detect.** Found by the audit, not by the logs: there were no security logs yet (SEC-17). The audit did not use the keys. Today, `gitleaks` in the pre-commit hook and GitHub secret scanning would flag such a commit before or as it is pushed.

**2. Contain: rotate keys** ([section 2](#2-contain-rotate-keys)).
- Remove the values from the repository: every secret in `render.yaml` became `sync: false`, and a `gitleaks` pre-commit hook blocks new ones. Git history is not rewritten (decision Q3); the old values are useless once rotated.
- Create a Supabase secret key, set it as `SUPABASE_SECRET_KEY` on Render, check uploads, then disable the legacy `anon` and `service_role` keys.
- Turn off the Data API (or stop exposing `public`), and enable RLS on every table. RLS is the `20261023000000_enable_rls` migration, applied by `prisma migrate deploy`. Check `GET <SUPABASE_URL>/rest/v1/User` is refused.
- `JWT_SECRET`: JWT is gone (ADR 0010), so the leaked secret signs nothing the server accepts. Delete the variable from Render.
- Turn on GitHub secret scanning, push protection and private vulnerability reporting.

> TODO(ticket 05): fill in the date of each step above, who did it, and the outcome (upload check after the key change, the `GET /rest/v1/User` result).

**3. Contain: revoke Sessions** ([section 3](#3-contain-revoke-sessions)). Switching from JWT to Sessions already invalidated every old token: every user has to sign in again. After the deploy, run `npm run sessions:revoke --workspace=server -- --all` once anyway. It ends any Session created by someone who signed in with a forged identity or a planted account in between.

**4. Assess** ([section 4](#4-assess-the-impact)).
- Exposure window: from commit `25121a1` until the legacy keys were disabled.
- Supabase API gateway, PostgREST and Storage logs for that window: any request using the `service_role` or `anon` key that did not come from the app.
- Application data: accounts nobody recognizes; bucket objects no message references (the data upgrade command deletes them, [`--dry-run`](#data-upgrade-command) first).
- Back up with `pg_dump` before running the data upgrade command.

> TODO(ticket 05): record the result of the Supabase log review for the exposure window (requests made with the leaked keys, if any).

**5. Notify** ([section 5](#5-notify-users)). Production had no real users yet, only test data, so no notification was sent. The remaining risk that old data was read or that rows were planted is accepted and listed in [`SECURITY.md`](../SECURITY.md#accepted-risks).

### Operator checklist

The manual steps of the security upgrade, from the [spec](../.scratch/cyber-upgradation/spec.md). Steps 1–3, 5 and 6 belong to ticket 05; steps 4 and 7 to the production rollout (ticket 21).

1. Supabase: create a new secret key (`sb_secret_...`) and set it as `SUPABASE_SECRET_KEY` on Render.
2. Supabase: disable the two legacy keys, `anon` and `service_role`.
3. Supabase: turn off the Data API, or remove `public` from the exposed schemas. Check: `GET /rest/v1/User` with the new key returns an error or an empty list.
4. Supabase: make the `attachments` bucket private, after the data upgrade command has run.
5. Render: delete `JWT_SECRET` and the old Supabase key variables, set `APP_ORIGIN`, and confirm every `sync: false` variable has a value ([checklist](#render-environment-checklist)).
6. GitHub: turn on secret scanning, push protection and private vulnerability reporting.
7. After the deploy, check CSP and cookies in DevTools on production: no CSP errors in the console; the `__Host-session` cookie has `HttpOnly`, `Secure` and `SameSite=Strict`; nothing in localStorage. Signing in, sending an image, previewing a document, sending a GIF and kicking a member all work.
