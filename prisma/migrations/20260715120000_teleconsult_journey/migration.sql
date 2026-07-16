-- AlterTable: associate a teleconsult with a journey (one active consult per journey,
-- enforced in TeleconsultService.book). Nullable so dashboard-initiated consults work.
ALTER TABLE "teleconsults" ADD COLUMN "journeyId" TEXT;

-- CreateIndex
CREATE INDEX "teleconsults_journeyId_idx" ON "teleconsults"("journeyId");

-- AddForeignKey
ALTER TABLE "teleconsults" ADD CONSTRAINT "teleconsults_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
