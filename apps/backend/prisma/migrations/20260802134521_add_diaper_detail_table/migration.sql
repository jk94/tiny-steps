-- CreateTable
CREATE TABLE "DiaperDetail" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "diaperType" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "DiaperDetail_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
