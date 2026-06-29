-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "categorizedAt" TIMESTAMP(3),
ADD COLUMN     "category" "LeadCategory",
ADD COLUMN     "categoryReason" TEXT;

-- CreateIndex
CREATE INDEX "leads_category_idx" ON "leads"("category");

