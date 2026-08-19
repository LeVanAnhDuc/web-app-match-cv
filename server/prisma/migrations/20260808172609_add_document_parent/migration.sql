-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Document_parentId_idx" ON "Document"("parentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
