-- AlterTable
ALTER TABLE "Event" ADD COLUMN "endedAt" DATETIME;
ALTER TABLE "Event" ADD COLUMN "startedAt" DATETIME;

-- CreateTable
CREATE TABLE "FeedingDetail" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "feedingType" TEXT NOT NULL,
    "side" TEXT,
    "amountMl" INTEGER,
    "note" TEXT,
    CONSTRAINT "FeedingDetail_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
