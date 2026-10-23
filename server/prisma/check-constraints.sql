-- CHECK constraints that prisma/schema.prisma cannot express (Prisma has no syntax for them).
-- scripts/generate-schema-sql.mjs appends this file to the generated prisma/schema.sql, so the
-- tests' PGlite database enforces them too. Production got them from the contract migration
-- (prisma/migrations/20261027000000_contract). To change one, add a migration AND edit this file:
-- tests/migrations.test.ts fails if the two disagree.

-- Case-insensitive username uniqueness: the unique key must be the lowercase username.
ALTER TABLE "User" ADD CONSTRAINT "User_usernameNormalized_check" CHECK ("usernameNormalized" = lower("username"));

-- Emails are stored lowercase, so the unique index on "email" is case-insensitive.
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase_check" CHECK ("email" = lower("email"));

-- Room name: 1–64 characters, not blank. Description: at most 500 characters (ROOM_RULES).
ALTER TABLE "Room" ADD CONSTRAINT "Room_name_length_check" CHECK (char_length("name") <= 64 AND btrim("name") <> '');
ALTER TABLE "Room" ADD CONSTRAINT "Room_description_length_check" CHECK (char_length("description") <= 500);
