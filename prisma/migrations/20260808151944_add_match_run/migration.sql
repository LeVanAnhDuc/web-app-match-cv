-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('succeeded', 'failed');

-- AlterTable
ALTER TABLE "MatchResult" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "runId" TEXT,
ADD COLUMN     "status" "MatchStatus" NOT NULL DEFAULT 'succeeded';

-- CreateTable
CREATE TABLE "MatchRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvDocumentId" TEXT NOT NULL,
    "jdDocumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchRun_userId_idx" ON "MatchRun"("userId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_cvDocumentId_fkey" FOREIGN KEY ("cvDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRun" ADD CONSTRAINT "MatchRun_jdDocumentId_fkey" FOREIGN KEY ("jdDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
