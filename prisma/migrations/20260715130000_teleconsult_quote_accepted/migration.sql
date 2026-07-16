-- AlterTable: record when the patient accepts the doctor's quote. This timestamp
-- is the go-signal that unlocks trip planning (accepted amount = treatment cost).
ALTER TABLE "teleconsults" ADD COLUMN "quoteAcceptedAt" TIMESTAMP(3);
