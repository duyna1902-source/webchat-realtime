-- Enable Row Level Security on every table in this schema, including Prisma's own
-- "_prisma_migrations" (created by `prisma migrate deploy` before it runs any migration).
--
-- No policy is created on purpose (decision Q42): if Supabase's Data API (PostgREST) is ever
-- re-enabled, its roles (anon, authenticated, service key without BYPASSRLS) read no rows.
-- Prisma connects as the role that owns the tables, and RLS is not FORCEd, so Prisma is unaffected.
--
-- This only covers tables that exist now. Every later migration that creates a table must
-- also run `ALTER TABLE "<Table>" ENABLE ROW LEVEL SECURITY;` (tests/migrations.test.ts checks it).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = current_schema()
       AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', current_schema(), t.relname);
  END LOOP;
END
$$;
