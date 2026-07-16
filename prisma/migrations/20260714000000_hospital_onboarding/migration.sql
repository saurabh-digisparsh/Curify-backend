-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'BOOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationDocType" AS ENUM ('HOSPITAL_REGISTRATION', 'ENTITY_REGISTRATION', 'GST_CERTIFICATE', 'PAN_CARD', 'TRADE_LICENSE', 'FIRE_SAFETY_NOC', 'POLLUTION_CONTROL_CONSENT', 'DRUG_PHARMACY_LICENSE', 'BLOOD_BANK_LICENSE', 'AERB_LICENSE', 'PROFESSIONAL_INDEMNITY', 'PUBLIC_LIABILITY', 'NABH_CERTIFICATE', 'NABL_CERTIFICATE', 'JCI_CERTIFICATE', 'MVTF_EMPANELMENT', 'SIGNATORY_ID', 'BOARD_RESOLUTION', 'DOCTOR_COUNCIL_REGISTRATION', 'DOCTOR_DEGREE', 'DOCTOR_PHOTO', 'OTHER');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'HOSPITAL';

-- AlterTable
ALTER TABLE "hospitals" ADD COLUMN     "approvalStatus" "ApprovalStatus",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "nabhAccredited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "surgeons" ADD COLUMN     "degrees" JSONB,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "hospitalId" TEXT,
ADD COLUMN     "medicalCouncilReg" TEXT,
ADD COLUMN     "slotToken" TEXT;

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "doctorId" TEXT,
    "type" "VerificationDocType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_slots" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_documents_hospitalId_idx" ON "verification_documents"("hospitalId");

-- CreateIndex
CREATE INDEX "consultation_slots_doctorId_date_idx" ON "consultation_slots"("doctorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_ownerUserId_key" ON "hospitals"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "surgeons_slotToken_key" ON "surgeons"("slotToken");

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surgeons" ADD CONSTRAINT "surgeons_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "surgeons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_slots" ADD CONSTRAINT "consultation_slots_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "surgeons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

