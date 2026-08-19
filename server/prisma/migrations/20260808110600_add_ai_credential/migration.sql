-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('openrouter', 'openai', 'gemini');

-- CreateEnum
CREATE TYPE "AiTestStatus" AS ENUM ('ok', 'invalid_key', 'no_quota', 'model_unavailable', 'unreachable');

-- AlterTable
-- MatchResult gains a snapshot of which AI produced the row. The three NOT NULL
-- columns are added WITH a default so existing rows backfill, then the default
-- is dropped so every future write must state the provider explicitly rather
-- than silently inherit "openrouter". Backfilling with the OpenRouter env
-- defaults is exact: every match created before this migration ran through
-- them, because they were the only configuration that existed.
ALTER TABLE "MatchResult" ADD COLUMN     "credentialId" TEXT,
ADD COLUMN     "provider" "AiProvider" NOT NULL DEFAULT 'openrouter',
ADD COLUMN     "chatModel" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
ADD COLUMN     "embedModel" TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small';

ALTER TABLE "MatchResult" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "MatchResult" ALTER COLUMN "chatModel" DROP DEFAULT;
ALTER TABLE "MatchResult" ALTER COLUMN "embedModel" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AiCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedKey" BYTEA NOT NULL,
    "keyIv" BYTEA NOT NULL,
    "keyTag" BYTEA NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "chatModel" TEXT,
    "embedModel" TEXT,
    "lastTestStatus" "AiTestStatus",
    "lastTestedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCredential_userId_idx" ON "AiCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiCredential_userId_label_key" ON "AiCredential"("userId", "label");

-- AddForeignKey
-- SET NULL, not CASCADE: deleting a credential must not delete the history of
-- matches it ran. The provider/model snapshot above keeps those rows readable.
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AiCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCredential" ADD CONSTRAINT "AiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
