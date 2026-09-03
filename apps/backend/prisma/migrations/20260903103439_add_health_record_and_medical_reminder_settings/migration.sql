-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "administeredAt" DATETIME,
    "dueAt" DATETIME,
    "doseAmount" REAL,
    "doseUnit" TEXT,
    "vaccineBatch" TEXT,
    "note" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderLastSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HealthRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "feedingReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "feedingReminderThresholdHours" INTEGER NOT NULL DEFAULT 4,
    "feedingReminderLastSentAt" DATETIME,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySummaryHourLocal" INTEGER NOT NULL DEFAULT 20,
    "medicalReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "medicalReminderLeadDays" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationSettings_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_NotificationSettings" ("childId", "createdAt", "dailySummaryEnabled", "dailySummaryHourLocal", "feedingReminderEnabled", "feedingReminderLastSentAt", "feedingReminderThresholdHours", "id", "updatedAt", "userId") SELECT "childId", "createdAt", "dailySummaryEnabled", "dailySummaryHourLocal", "feedingReminderEnabled", "feedingReminderLastSentAt", "feedingReminderThresholdHours", "id", "updatedAt", "userId" FROM "NotificationSettings";
DROP TABLE "NotificationSettings";
ALTER TABLE "new_NotificationSettings" RENAME TO "NotificationSettings";
CREATE UNIQUE INDEX "NotificationSettings_userId_childId_key" ON "NotificationSettings"("userId", "childId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "HealthRecord_childId_dueAt_idx" ON "HealthRecord"("childId", "dueAt");

-- CreateIndex
CREATE INDEX "HealthRecord_childId_administeredAt_idx" ON "HealthRecord"("childId", "administeredAt");
