-- Expand (ticket 07): the lowercase username key, nullable for now. The data upgrade command
-- fills it for existing rows; the contract migration (ticket 20) makes it NOT NULL and UNIQUE.
-- Until then the app checks case-insensitive uniqueness itself.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "usernameNormalized" TEXT;
