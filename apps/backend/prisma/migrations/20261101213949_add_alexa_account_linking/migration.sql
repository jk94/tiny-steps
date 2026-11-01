-- CreateTable
CREATE TABLE "AlexaAccountLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "defaultChildId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "AlexaAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlexaAccountLink_defaultChildId_fkey" FOREIGN KEY ("defaultChildId") REFERENCES "Child" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlexaAccessToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlexaAccessToken_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AlexaAccountLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlexaAuthorizationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT,
    "codeChallengeMethod" TEXT,
    "defaultChildId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "linkId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlexaAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AlexaAccountLink_refreshTokenHash_key" ON "AlexaAccountLink"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AlexaAccountLink_userId_idx" ON "AlexaAccountLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlexaAccessToken_tokenHash_key" ON "AlexaAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AlexaAccessToken_linkId_expiresAt_idx" ON "AlexaAccessToken"("linkId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlexaAuthorizationCode_codeHash_key" ON "AlexaAuthorizationCode"("codeHash");
