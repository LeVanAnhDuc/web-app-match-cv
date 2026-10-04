-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";

-- DropForeignKey
ALTER TABLE "MatchResult" DROP CONSTRAINT "MatchResult_cvDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "MatchResult" DROP CONSTRAINT "MatchResult_jdDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "MatchResult" DROP CONSTRAINT "MatchResult_userId_fkey";

-- DropForeignKey
ALTER TABLE "MatchRun" DROP CONSTRAINT "MatchRun_cvDocumentId_fkey";

-- DropForeignKey
ALTER TABLE "MatchRun" DROP CONSTRAINT "MatchRun_jdDocumentId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "guestExpiresAt" TIMESTAMP(3),
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- @updatedAt has no database default; the default above only backfills existing rows.
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestUsage" (
    "ipHash" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuestUsage_pkey" PRIMARY KEY ("ipHash","day")
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalSub_key" ON "User"("externalSub");

-- CreateIndex
CREATE INDEX "User_isGuest_guestExpiresAt_idx" ON "User"("isGuest", "guestExpiresAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_cvDocumentId_fkey" FOREIGN KEY ("cvDocumentId") REFERENCES "Document"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_jdDocumentId_fkey" FOREIGN KEY ("jdDocumentId") REFERENCES "Document"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_cvDocumentId_fkey" FOREIGN KEY ("cvDocumentId") REFERENCES "Document"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_jdDocumentId_fkey" FOREIGN KEY ("jdDocumentId") REFERENCES "Document"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- FR-18 / ADR-0023: the mock user of ADR-0008 is gone. Its rows are deleted,
-- not migrated (decided with the user 2026-10-04). Cascades above make this
-- one statement.
DELETE FROM "User" WHERE "id" = '00000000-0000-0000-0000-000000000001';
