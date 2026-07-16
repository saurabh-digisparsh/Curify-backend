-- CreateEnum
CREATE TYPE "TeleconsultStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "teleconsults" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "roomName" TEXT NOT NULL,
    "status" "TeleconsultStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teleconsults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teleconsults_roomName_key" ON "teleconsults"("roomName");

-- CreateIndex
CREATE INDEX "teleconsults_patientId_idx" ON "teleconsults"("patientId");

-- CreateIndex
CREATE INDEX "teleconsults_doctorId_scheduledAt_idx" ON "teleconsults"("doctorId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "teleconsults" ADD CONSTRAINT "teleconsults_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teleconsults" ADD CONSTRAINT "teleconsults_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "onboarding_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
