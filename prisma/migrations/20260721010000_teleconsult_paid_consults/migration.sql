-- Paid teleconsults: the 3rd+ consult on a journey must be paid for before the
-- held slot becomes a real booking.

-- New status for a slot held while the patient is in checkout. Added (not used)
-- in this transaction, which PostgreSQL allows.
ALTER TYPE "TeleconsultStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT' BEFORE 'SCHEDULED';

-- paymentId: the captured Payment that unlocked this consult (unique so one
-- payment can never redeem two consults). holdExpiresAt: when an unpaid hold
-- releases its slot back to the doctor's availability.
ALTER TABLE "teleconsults" ADD COLUMN "paymentId" TEXT;
ALTER TABLE "teleconsults" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "teleconsults_paymentId_key" ON "teleconsults"("paymentId");
