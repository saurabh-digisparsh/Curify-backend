-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('ESSENTIAL', 'COMFORT', 'PREMIUM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "reportRef" TEXT NOT NULL,
    "filename" TEXT,
    "fileType" TEXT,
    "language" TEXT,
    "confidence" INTEGER,
    "conditionName" TEXT,
    "conditionMedical" TEXT,
    "conditionPlain" TEXT,
    "severity" TEXT,
    "patientAge" INTEGER,
    "patientName" TEXT,
    "scanType" TEXT,
    "scanDate" TEXT,
    "referringDoctor" TEXT,
    "flags" JSONB,
    "rawAnalysis" JSONB,
    "treatment" TEXT,
    "country" TEXT,
    "urgency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "flag" TEXT,
    "imageUrl" TEXT,
    "jciAccredited" BOOLEAN NOT NULL DEFAULT false,
    "fairnessScore" INTEGER,
    "overallRating" DOUBLE PRECISION,
    "quotedPriceUsd" INTEGER,
    "localPriceUsd" INTEGER,
    "localBenchmarkUsd" INTEGER,
    "included" JSONB,
    "notIncluded" JSONB,
    "pros" JSONB,
    "cons" JSONB,
    "mysteryShopperScore" INTEGER,
    "patientsPerYear" INTEGER,
    "internationalPercent" TEXT,
    "surgeonId" TEXT,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surgeons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "hospital" TEXT,
    "country" TEXT,
    "flag" TEXT,
    "photoUrl" TEXT,
    "specialization" TEXT,
    "yearsExperience" INTEGER,
    "totalProcedures" INTEGER,
    "aclSpecific" INTEGER,
    "successRate" DOUBLE PRECISION,
    "complications" DOUBLE PRECISION,
    "education" JSONB,
    "publications" INTEGER,
    "languages" JSONB,
    "awards" JSONB,
    "patientRating" DOUBLE PRECISION,
    "avgSurgeryTime" TEXT,
    "nextAvailable" TEXT,

    CONSTRAINT "surgeons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "surgeonId" TEXT,
    "reviewerName" TEXT NOT NULL,
    "nationality" TEXT,
    "age" INTEGER,
    "procedure" TEXT,
    "rating" INTEGER NOT NULL,
    "reviewDate" TEXT,
    "text" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT,
    "hospitalId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'ESSENTIAL',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentRef" TEXT,
    "travelDate" TIMESTAMP(3),
    "surgeryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "checkIns" JSONB,
    "tips" JSONB,
    "handoff" JSONB,
    "insuranceClaim" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_links" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "memberId" TEXT,
    "bookingId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "relation" TEXT,
    "accessCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reportRef_key" ON "reports"("reportRef");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reportId_key" ON "bookings"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_plans_bookingId_key" ON "recovery_plans"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "family_links_accessCode_key" ON "family_links"("accessCode");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "surgeons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plans" ADD CONSTRAINT "recovery_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plans" ADD CONSTRAINT "recovery_plans_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
