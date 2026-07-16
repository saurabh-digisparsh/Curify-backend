-- AlterTable
ALTER TABLE "hospital_applications" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "patientsPerYear" INTEGER,
ADD COLUMN     "procedures" TEXT[],
ADD COLUMN     "quotedPriceUsd" INTEGER;

