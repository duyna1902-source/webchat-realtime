-- Expand (ticket 14, ADR 0009): marks a message whose legacy attachment the data upgrade
-- removed, because its URL was not an object of the project bucket (or a GIF was not from
-- Giphy). Clients show "Tệp đính kèm không còn khả dụng" for it. No new table, so no RLS change.

-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "attachmentUnavailable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RoomMessage" ADD COLUMN     "attachmentUnavailable" BOOLEAN NOT NULL DEFAULT false;
