-- Phase 3: classification confidence, ensemble votes, and human-in-the-loop review flags.
-- Purely additive (nullable columns + a defaulted boolean + indexes).

-- AlterTable: leads
ALTER TABLE "leads"
  ADD COLUMN "categoryConfidence" INTEGER,
  ADD COLUMN "categoryVotes" JSONB,
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- AlterTable: source_captures
ALTER TABLE "source_captures"
  ADD COLUMN "categoryConfidence" INTEGER,
  ADD COLUMN "categoryVotes" JSONB,
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "leads_needsReview_idx" ON "leads"("needsReview");
CREATE INDEX "source_captures_needsReview_idx" ON "source_captures"("needsReview");
