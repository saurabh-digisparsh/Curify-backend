-- AlterTable
ALTER TABLE "journeys" ADD COLUMN     "travelDate" TIMESTAMP(3),
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false;
