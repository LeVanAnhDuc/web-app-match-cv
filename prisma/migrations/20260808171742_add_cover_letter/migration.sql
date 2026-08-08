-- CreateEnum
CREATE TYPE "CoverLetterTone" AS ENUM ('formal', 'friendly');

-- CreateEnum
CREATE TYPE "CoverLetterLength" AS ENUM ('short', 'standard');

-- CreateEnum
CREATE TYPE "CoverLetterLanguage" AS ENUM ('en', 'vi');

-- CreateEnum
CREATE TYPE "CoverLetterStatus" AS ENUM ('succeeded', 'failed');

-- CreateTable
CREATE TABLE "CoverLetter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchResultId" TEXT NOT NULL,
    "tone" "CoverLetterTone" NOT NULL,
    "length" "CoverLetterLength" NOT NULL,
    "language" "CoverLetterLanguage" NOT NULL,
    "content" TEXT NOT NULL,
    "omittedRequirements" TEXT[],
    "status" "CoverLetterStatus" NOT NULL,
    "errorCode" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "credentialId" TEXT,
    "provider" "AiProvider" NOT NULL,
    "chatModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverLetter_userId_matchResultId_idx" ON "CoverLetter"("userId", "matchResultId");

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "MatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AiCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
