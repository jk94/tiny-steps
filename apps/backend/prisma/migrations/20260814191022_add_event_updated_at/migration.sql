/*
  Warnings:

  - Added the required column `updatedAt` to the `Event` table without a default value.

  Manual edit (see ADR-0011): Prisma emitted the SQLite table-rebuild pattern
  for adding the new NOT-NULL `updatedAt` column. The auto-generated INSERT did
  NOT carry a value for `updatedAt`, which would violate the NOT NULL constraint
  on any non-empty table. The INSERT below is edited to backfill `updatedAt`
  from each pre-existing row's `createdAt`, so historical rows inherit their
  creation time rather than all appearing "just modified" at migration time.
*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("childId", "createdAt", "endedAt", "id", "occurredAt", "startedAt", "type", "userId", "updatedAt") SELECT "childId", "createdAt", "endedAt", "id", "occurredAt", "startedAt", "type", "userId", "createdAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
