-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvDocumentId" TEXT NOT NULL,
    "jdDocumentId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "semanticScore" INTEGER NOT NULL,
    "keywordScore" INTEGER NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchResult_userId_idx" ON "MatchResult"("userId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_cvDocumentId_fkey" FOREIGN KEY ("cvDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_jdDocumentId_fkey" FOREIGN KEY ("jdDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
