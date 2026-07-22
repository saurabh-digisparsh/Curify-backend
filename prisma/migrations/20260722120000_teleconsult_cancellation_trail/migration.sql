-- Cancellation trail on a teleconsult: who cancelled it and the comment they left.
-- The patient UI shows "your doctor cancelled — here's why", and the free-consult
-- allowance already ignores CANCELLED rows, so neither side loses a free call.
ALTER TABLE "teleconsults" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "teleconsults" ADD COLUMN "cancelReason" TEXT;
