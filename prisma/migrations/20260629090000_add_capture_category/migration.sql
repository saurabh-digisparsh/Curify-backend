-- CreateEnum
CREATE TYPE "LeadCategory" AS ENUM ('LEAD', 'MARKETING', 'NEWS', 'OTHER');

-- AlterTable
ALTER TABLE "source_captures" ADD COLUMN     "categorizedAt" TIMESTAMP(3),
ADD COLUMN     "category" "LeadCategory",
ADD COLUMN     "categoryReason" TEXT;

-- CreateIndex
CREATE INDEX "source_captures_category_idx" ON "source_captures"("category");

