-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'CONTACT_VERIFYING', 'ACCREDITATION', 'VALIDATING', 'AGREEMENT', 'PROVISIONED', 'SETUP', 'LIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccreditationBody" AS ENUM ('NABH', 'JCI');

-- CreateEnum
CREATE TYPE "AccreditationSource" AS ENUM ('REGISTRY', 'CERT_UPLOAD');

-- CreateEnum
CREATE TYPE "OnboardingDocType" AS ENUM ('REGISTRATION', 'COUNCIL_REGISTRATION', 'FIRE_BUILDING_SAFETY', 'BIOMEDICAL_WASTE', 'INDEMNITY_INSURANCE', 'SIGNATORY_ID', 'DOCTOR_PHOTO', 'DOCTOR_DEGREE', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilitySource" AS ENUM ('SELF', 'COORDINATOR', 'CALENDAR');

-- CreateEnum
CREATE TYPE "OnboardingDoctorStatus" AS ENUM ('APPROVED', 'IN_REVIEW', 'ON_LEAVE');

-- DropForeignKey
ALTER TABLE "consultation_slots" DROP CONSTRAINT "consultation_slots_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "consultation_slots" DROP CONSTRAINT "consultation_slots_patientId_fkey";

-- DropForeignKey
ALTER TABLE "verification_documents" DROP CONSTRAINT "verification_documents_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "verification_documents" DROP CONSTRAINT "verification_documents_hospitalId_fkey";

-- DropIndex
DROP INDEX "surgeons_slotToken_key";

-- AlterTable
ALTER TABLE "hospitals" DROP COLUMN "approvedAt",
DROP COLUMN "reviewNote",
DROP COLUMN "submittedAt",
ADD COLUMN     "priority" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "surgeons" DROP COLUMN "slotToken";

-- DropTable
DROP TABLE "consultation_slots";

-- DropTable
DROP TABLE "verification_documents";

-- DropEnum
DROP TYPE "SlotStatus";

-- DropEnum
DROP TYPE "VerificationDocType";

-- CreateTable
CREATE TABLE "hospital_applications" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "registrationNo" TEXT,
    "ownership" TEXT,
    "website" TEXT,
    "totalBeds" INTEGER,
    "icuBeds" INTEGER,
    "airportDistanceKm" INTEGER,
    "specialties" TEXT[],
    "insurers" TEXT[],
    "languages" TEXT[],
    "intlFacilities" TEXT[],
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "notAccredited" BOOLEAN NOT NULL DEFAULT false,
    "ownerUserId" TEXT,
    "publishedHospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorised_contacts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "workEmail" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "whatsappVerifiedAt" TIMESTAMP(3),
    "emailOtp" TEXT,
    "emailOtpExp" TIMESTAMP(3),
    "emailOtpTries" INTEGER NOT NULL DEFAULT 0,
    "waOtp" TEXT,
    "waOtpExp" TIMESTAMP(3),
    "waOtpTries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorised_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accreditation_records" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "body" "AccreditationBody" NOT NULL,
    "identifier" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "source" "AccreditationSource" NOT NULL DEFAULT 'CERT_UPLOAD',
    "status" "DocStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accreditation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "doctorId" TEXT,
    "type" "OnboardingDocType" NOT NULL,
    "autoClassifiedType" "OnboardingDocType",
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT,
    "status" "DocStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_agreements" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "payoutRail" TEXT,
    "signatoryName" TEXT NOT NULL,
    "ip" TEXT,
    "terms" JSONB,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_doctors" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "name" TEXT NOT NULL,
    "qualifications" TEXT,
    "specialty" TEXT,
    "subspecialty" TEXT,
    "yearsExperience" INTEGER,
    "registrationNo" TEXT,
    "languages" TEXT[],
    "bio" TEXT,
    "proceduresPerformed" INTEGER,
    "email" TEXT,
    "teleconsultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "OnboardingDoctorStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "availabilityToken" TEXT,
    "publishedSurgeonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_windows" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "source" "AvailabilitySource" NOT NULL DEFAULT 'SELF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospital_applications_ownerUserId_key" ON "hospital_applications"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_applications_publishedHospitalId_key" ON "hospital_applications"("publishedHospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "authorised_contacts_applicationId_key" ON "authorised_contacts"("applicationId");

-- CreateIndex
CREATE INDEX "accreditation_records_applicationId_idx" ON "accreditation_records"("applicationId");

-- CreateIndex
CREATE INDEX "onboarding_documents_applicationId_idx" ON "onboarding_documents"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "commission_agreements_applicationId_key" ON "commission_agreements"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_doctors_availabilityToken_key" ON "onboarding_doctors"("availabilityToken");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_doctors_publishedSurgeonId_key" ON "onboarding_doctors"("publishedSurgeonId");

-- CreateIndex
CREATE INDEX "onboarding_doctors_applicationId_idx" ON "onboarding_doctors"("applicationId");

-- CreateIndex
CREATE INDEX "availability_windows_doctorId_weekday_idx" ON "availability_windows"("doctorId", "weekday");

-- AddForeignKey
ALTER TABLE "hospital_applications" ADD CONSTRAINT "hospital_applications_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_applications" ADD CONSTRAINT "hospital_applications_publishedHospitalId_fkey" FOREIGN KEY ("publishedHospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorised_contacts" ADD CONSTRAINT "authorised_contacts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hospital_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accreditation_records" ADD CONSTRAINT "accreditation_records_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hospital_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_documents" ADD CONSTRAINT "onboarding_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hospital_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_documents" ADD CONSTRAINT "onboarding_documents_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "onboarding_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hospital_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_doctors" ADD CONSTRAINT "onboarding_doctors_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hospital_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "onboarding_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

