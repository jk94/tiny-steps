-- AlterTable
ALTER TABLE "Child" ADD COLUMN "sex" TEXT;

-- CreateTable
CREATE TABLE "GrowthMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredAt" DATETIME NOT NULL,
    "weightGrams" INTEGER,
    "lengthMillimeters" INTEGER,
    "headCircumferenceMillimeters" INTEGER,
    "lengthMeasurementPosition" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GrowthMeasurement_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GrowthMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GrowthMeasurement_childId_measuredAt_idx" ON "GrowthMeasurement"("childId", "measuredAt");
