# Database migrations

The database schema is managed with **Prisma Migrate**. `prisma db push` is no longer used. Every schema change is a versioned migration in `server/prisma/migrations/`, and production applies them with `prisma migrate deploy` (decision Q31).

Run every command below from `server/`, or through `npm run <script> --workspace=server` from the repo root. Commands that touch a database use whatever `DATABASE_URL` is set in the environment or in `.env`. There is no fallback URL, so check which database `DATABASE_URL` points at before you run one.

## Files

| Path | What it is |
|---|---|
| `server/prisma/schema.prisma` | The source of truth for the schema. |
| `server/prisma/migrations/0_baseline/` | The schema as production had it when it was created with `db push`. It is the output of `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` at the commit that added it. Never edit it. |
| `server/prisma/migrations/20261023000000_enable_rls/` | Enables Row Level Security, with no policy, on every table that exists at that point, including Prisma's `_prisma_migrations` (decision Q42). |
| `server/prisma/migrations/20261024000000_expand_username_normalized/` | Expand (ticket 07): adds the nullable `User.usernameNormalized` key. The data upgrade fills it; the contract migration makes it required and unique. |
| `server/prisma/migrations/20261025000000_expand_attachments/` | Expand (ticket 13, ADR 0009): adds the `Attachment` table (RLS on) with nullable, unique links to a Direct Message or Room Message. The legacy `attachmentUrl`/`attachmentName`/`attachmentSize` columns stay until the contract migration. |
| `server/prisma/migrations/20261026000000_expand_attachment_unavailable/` | Expand (ticket 14): adds `attachmentUnavailable` (default false) to `DirectMessage` and `RoomMessage`. The data upgrade sets it on messages whose legacy attachment or GIF it removed; message DTOs carry it. |
| `server/prisma/migrations/20261027000000_contract/` | Contract (ticket 20). Refuses to run, changing nothing, while any row is not normalized yet (see below). Then drops `User.avatarUrl` and the `attachmentUrl`/`attachmentName`/`attachmentSize` columns of `DirectMessage` and `RoomMessage` (`attachmentUnavailable` stays), makes `usernameNormalized` `NOT NULL UNIQUE`, and adds the CHECK constraints of `check-constraints.sql`. |
| `server/prisma/check-constraints.sql` | The CHECK constraints Prisma's schema cannot express: `usernameNormalized = lower(username)`, `email = lower(email)`, room `name` 1–64 characters and not blank, `description` at most 500 characters. The generator appends it to `schema.sql`. A change needs a new migration **and** an edit here; the drift test fails if they disagree. |
| `server/prisma/schema.sql` | **Generated. Do not edit by hand.** It is the DDL that the tests load into in-memory PGlite. Regenerate it with `npm run db:schema-sql`. |
| `server/scripts/generate-schema-sql.mjs` | The generator: `prisma migrate diff --from-empty` output followed by `check-constraints.sql`. With `--check` it fails if `schema.sql` is stale, and the test suite runs that check. |
| `server/src/upgrade/` and `server/src/cli/upgrade-data.ts` | The data upgrade command (see below). |

## npm scripts (in `server/`)

| Script | Runs | Touches a DB |
|---|---|---|
| `db:schema-sql` | Regenerates `prisma/schema.sql` from `schema.prisma` | No |
| `db:deploy` | `prisma migrate deploy`: applies pending migrations | Yes |
| `db:migrate` | `prisma migrate dev`: local development only, needs a disposable database | Yes |
| `db:upgrade-data` | The data upgrade command; pass `-- --dry-run` first | Yes |

## Adding a migration

1. Edit `server/prisma/schema.prisma`.
2. Write the migration SQL offline. Diff the previous schema against the new one:
   ```bash
   git show HEAD:server/prisma/schema.prisma > /tmp/previous.prisma
   mkdir prisma/migrations/<yyyymmddhhmmss>_<name>
   npx prisma migrate diff --from-schema /tmp/previous.prisma --to-schema prisma/schema.prisma --script \
     -o prisma/migrations/<yyyymmddhhmmss>_<name>/migration.sql
   ```
   Name the directory with a UTC timestamp. Prisma applies migrations in directory-name order, and `0_baseline` sorts first.
3. If the migration creates a table, append `ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY;` to it. The RLS migration only covered the tables that existed when it ran.
4. Run `npm run db:schema-sql`.
5. Run the server tests. `tests/migrations.test.ts` fails in three cases:
   - `schema.sql` is stale.
   - The migrations do not build the same schema as `schema.prisma`.
   - A table has RLS disabled.

Schema changes follow the order **expand → data → contract**:

1. Expand migrations only add tables and nullable columns.
2. The data upgrade command normalizes production data.
3. The contract migration drops old columns and adds the constraints.

The contract migration must fail if the data step has not run.

### The contract migration (ticket 20)

Since the contract migration, the database itself refuses rows that break the account and room rules, even if the app misses one: a second account `Alice` next to `alice`, an email with capitals, a duplicate email, a room name over 64 characters or blank, a description over 500 characters. Registration no longer checks for a taken username or email before inserting. It inserts, and turns the unique-constraint error into the usual `400 VALIDATION_ERROR` on the `username` or `email` field, so two registrations racing for one name cannot both get in.

Its first statement is a guard. It counts the rows the data upgrade has not normalized yet:

- users without `usernameNormalized`, or with one that is not `lower(username)`;
- usernames shared by two accounts, ignoring case;
- emails that are not lowercase;
- users that still have an `avatarUrl`;
- rooms whose name or description is out of bounds;
- messages that still have a legacy `attachmentUrl`.

If it finds any, it raises an error that lists them and names the data upgrade command. The whole migration runs in one transaction, so nothing is dropped. `prisma migrate deploy` then records the migration as failed and refuses later deploys until you clear it:

```bash
npm run db:upgrade-data --workspace=server -- --dry-run   # read the report
npm run db:upgrade-data --workspace=server
npx prisma migrate resolve --rolled-back 20261027000000_contract   # from server/
```

Then deploy again.

The data upgrade steps still run after the contract migration. They report 0 changes. The steps that clean the dropped columns (`clear-avatar-urls`, `migrate-legacy-attachments`) use raw SQL, because those columns are no longer in the Prisma schema. They skip a column that no longer exists.

## Production: one-time baseline (ticket 21, done by a human)

Production was created with `db push`, so it has no `_prisma_migrations` table. Before the first deploy that runs `prisma migrate deploy`, tell Prisma that production already has the baseline:

1. Check out the commit that added `0_baseline`. Point `DATABASE_URL` at production, using a **direct or session-mode** connection. Supabase's transaction pooler on port 6543 does not work with Prisma Migrate.
2. Confirm that production matches the baseline. This command is read-only:
   ```bash
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
   ```
   It must print `-- This is an empty migration.` If it prints SQL, stop: production has drifted from the baseline.
3. Mark the baseline as applied. This creates `_prisma_migrations` and records `0_baseline` without running it:
   ```bash
   npx prisma migrate resolve --applied 0_baseline
   ```
4. Deploy. The Render start command is `npm run db:deploy --workspace=server && npm run start --workspace=server`, so `migrate deploy` applies every later migration (the RLS migration, then the expand migrations) before the server starts. Afterwards, `npx prisma migrate status` should report `Database schema is up to date!`.
5. Check that the Data API is locked: `GET <SUPABASE_URL>/rest/v1/User` must return an error or an empty list.

Prisma connects as the role that owns the tables, and RLS is not `FORCE`d, so the app keeps working with no policies.

The first deploy must not contain the contract migration yet: ticket 20 is merged only after the data upgrade has run on production (ticket 21). Then:

6. Run the data upgrade on production, `--dry-run` first, while nobody is uploading.
7. Merge ticket 20 and deploy. `migrate deploy` applies `20261027000000_contract`. If its guard refuses, see [The contract migration](#the-contract-migration-ticket-20).

While the new instance runs the contract migration, the old instance is still serving. Its Prisma client still selects the dropped columns, so requests that read users or messages fail until the new instance takes over. That takes a few seconds. Expect them.

## The data upgrade command

Against a real database, take a `pg_dump` backup first ([incident runbook](incident-runbook.md#back-up-the-database-before-any-data-operation)), and run the command while nobody is uploading.

```bash
npm run db:upgrade-data --workspace=server -- --dry-run   # report only
npm run db:upgrade-data --workspace=server                # apply
```

The command loads the normal server configuration (`loadConfig`). It connects Prisma to `DATABASE_URL`, builds the configured storage adapter, and then runs the steps registered in `server/src/upgrade/steps.ts` in order. It prints a report with each step's change count and details, such as `old -> new` for renamed accounts.

- **One transaction.** Every step runs inside a single database transaction. A failing step rolls back all of them.
- **Dry run.** `--dry-run` runs the same code and then rolls the transaction back, so its report already reflects each step seeing the earlier steps' changes. Storage writes cannot be rolled back. In a dry run, every storage method except the read-only ones (`list`, `createSignedUrl`, `createSignedUrls`) is skipped and listed in the report.
- **Idempotent.** Each step must report 0 changes on a second run.

Registered steps, in order:

| Step | What it does |
|---|---|
| `normalize-usernames` | Renames usernames that break the rules (3–32 characters of `[a-zA-Z0-9_.]`) to `user_<first 6 characters of the id>`. Of a case-insensitive duplicate pair, the account created first keeps its name. |
| `fill-username-normalized` | Sets `usernameNormalized` to the lowercase username. |
| `lowercase-emails` | Lowercases emails. A later account whose email clashes gets `+dup<n>` in the local part. |
| `clear-avatar-urls` | Sets every `avatarUrl` to null (the column is dropped by the contract migration). |
| `sanitize-rooms` | Removes control characters, trims, and cuts room names to 64 and descriptions to 500 characters. An empty name becomes `Room <first 6 characters of the id>`; an empty description becomes null. |
| `migrate-legacy-attachments` | For every message with a legacy `attachmentUrl`: a URL starting with `${SUPABASE_URL}/storage/v1/object/public/${bucket}/` on an `IMAGE` or `DOCUMENT` message becomes an `Attachment` (uploader = sender, `kind` from the message type, `mimeType` from the object's metadata or `application/octet-stream`, name cut to 255 characters, a negative or missing size becomes 0). Any other URL (`javascript:`, another domain, empty, another bucket, an object already given to an earlier message) is removed and the message is marked `attachmentUnavailable`; its `content` is kept. The legacy columns are cleared either way. |
| `convert-foreign-gifs` | An `EMOJI_GIF` message whose URL is not an https Giphy URL becomes a `TEXT` message with empty content, marked `attachmentUnavailable`. |
| `delete-orphaned-objects` | Deletes every bucket object (in nested folders too) that no `Attachment` references. Run it when nobody is uploading: an object uploaded during the run, before its `Attachment` row is committed, counts as an orphan. |

The report lists each changed username, email, room name and description as `old -> new` (very long values shortened), how many Attachments were created, each message that lost its attachment or GIF, and each deleted object.

To add a step, implement `UpgradeStep` from `server/src/upgrade/runner.ts`. Register it in `upgradeSteps()`, then test it through `runUpgradeCommand` against a database migrated up to `LAST_EXPAND_MIGRATION` with `tests/helpers/migrations.ts` (see `tests/upgrade-data.test.ts`). `tests/contract-migration.test.ts` runs the whole sequence: baseline, junk data, expand, the command, contract.
