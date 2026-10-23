-- Contract (ticket 20): runs only AFTER the data upgrade command has normalized production data
-- (npm run db:upgrade-data --workspace=server). It drops the legacy columns and moves the account
-- and room rules into the database, which from now on refuses rows that break them.
--
-- The guard below refuses to run while any row is not yet normalized, instead of dropping data
-- or failing halfway. The whole script runs as one transaction, so a refusal changes nothing.

DO $$
DECLARE
  problems text[] := ARRAY[]::text[];
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM "User"
   WHERE "usernameNormalized" IS NULL OR "usernameNormalized" <> lower("username");
  IF n > 0 THEN problems := problems || format('%s User row(s) without a normalized username key', n); END IF;

  SELECT count(*) INTO n FROM (
    SELECT lower("username") FROM "User" GROUP BY lower("username") HAVING count(*) > 1
  ) AS clashes;
  IF n > 0 THEN problems := problems || format('%s username(s) used by more than one account, ignoring case', n); END IF;

  SELECT count(*) INTO n FROM "User" WHERE "email" <> lower("email");
  IF n > 0 THEN problems := problems || format('%s User row(s) with an email that is not lowercase', n); END IF;

  SELECT count(*) INTO n FROM "User" WHERE "avatarUrl" IS NOT NULL;
  IF n > 0 THEN problems := problems || format('%s User row(s) still holding an avatarUrl', n); END IF;

  SELECT count(*) INTO n FROM "Room"
   WHERE char_length("name") > 64 OR btrim("name") = '' OR char_length("description") > 500;
  IF n > 0 THEN problems := problems || format('%s Room row(s) with a name or description out of bounds', n); END IF;

  SELECT count(*) INTO n FROM "DirectMessage" WHERE "attachmentUrl" IS NOT NULL;
  IF n > 0 THEN problems := problems || format('%s DirectMessage row(s) with a legacy attachmentUrl', n); END IF;

  SELECT count(*) INTO n FROM "RoomMessage" WHERE "attachmentUrl" IS NOT NULL;
  IF n > 0 THEN problems := problems || format('%s RoomMessage row(s) with a legacy attachmentUrl', n); END IF;

  IF array_length(problems, 1) > 0 THEN
    RAISE EXCEPTION 'Contract migration refused, the data is not normalized yet: %. Run the data upgrade command first (npm run db:upgrade-data --workspace=server -- --dry-run, then without --dry-run). If prisma migrate deploy recorded this migration as failed, mark it rolled back (npx prisma migrate resolve --rolled-back 20261027000000_contract) and deploy again.',
      array_to_string(problems, '; ');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl",
ALTER COLUMN "usernameNormalized" SET NOT NULL;

-- AlterTable
ALTER TABLE "DirectMessage" DROP COLUMN "attachmentName",
DROP COLUMN "attachmentSize",
DROP COLUMN "attachmentUrl";

-- AlterTable
ALTER TABLE "RoomMessage" DROP COLUMN "attachmentName",
DROP COLUMN "attachmentSize",
DROP COLUMN "attachmentUrl";

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameNormalized_key" ON "User"("usernameNormalized");

-- CHECK constraints Prisma's schema cannot express. Keep in sync with prisma/check-constraints.sql.
ALTER TABLE "User" ADD CONSTRAINT "User_usernameNormalized_check" CHECK ("usernameNormalized" = lower("username"));
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "Room" ADD CONSTRAINT "Room_name_length_check" CHECK (char_length("name") <= 64 AND btrim("name") <> '');
ALTER TABLE "Room" ADD CONSTRAINT "Room_description_length_check" CHECK (char_length("description") <= 500);
