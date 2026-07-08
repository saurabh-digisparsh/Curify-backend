-- BNPL support on bookings: payment method + deposit + instalment count.
ALTER TABLE "bookings" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'FULL';
ALTER TABLE "bookings" ADD COLUMN "downPayment" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "installments" INTEGER;
