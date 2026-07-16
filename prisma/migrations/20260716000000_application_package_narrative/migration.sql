-- AlterTable
ALTER TABLE "hospital_applications" ADD COLUMN     "cons" JSONB,
ADD COLUMN     "included" TEXT[],
ADD COLUMN     "localBenchmarkUsd" INTEGER,
ADD COLUMN     "notIncluded" TEXT[],
ADD COLUMN     "pros" JSONB;

