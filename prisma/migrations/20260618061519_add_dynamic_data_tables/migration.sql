-- AlterTable
ALTER TABLE "hospitals" ADD COLUMN     "intlOfficeEmail" TEXT,
ADD COLUMN     "intlOfficePhone" TEXT,
ADD COLUMN     "procedures" JSONB,
ADD COLUMN     "specialty" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "flags" JSONB,
ADD COLUMN     "lang" TEXT,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "tokens" JSONB,
ADD COLUMN     "totalReviews" INTEGER;

-- CreateTable
CREATE TABLE "stay_or_go_templates" (
    "id" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "homeCountry" TEXT NOT NULL,
    "homeCost" TEXT NOT NULL,
    "homeWaitTime" TEXT NOT NULL,
    "homeSuccessRate" TEXT NOT NULL,
    "homeRisk" TEXT NOT NULL,
    "homeQuality" TEXT NOT NULL,
    "indiaCost" TEXT NOT NULL,
    "indiaWaitTime" TEXT NOT NULL,
    "indiaSuccessRate" TEXT NOT NULL,
    "indiaRisk" TEXT NOT NULL,
    "indiaQuality" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "riskTimeline" JSONB NOT NULL,

    CONSTRAINT "stay_or_go_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_plan_templates" (
    "id" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,
    "costs" JSONB NOT NULL,
    "totalEstimate" TEXT NOT NULL,
    "travelTips" JSONB NOT NULL,
    "insuranceAlert" TEXT,

    CONSTRAINT "trip_plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_options" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "duration" TEXT NOT NULL,
    "stops" TEXT,
    "label" TEXT,
    "bookingUrl" TEXT,

    CONSTRAINT "flight_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "pricePerDay" INTEGER NOT NULL,
    "coverage" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "bookingUrl" TEXT,

    CONSTRAINT "insurance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_protocols" (
    "id" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "checkIns" JSONB NOT NULL,
    "tips" JSONB NOT NULL,
    "handoff" JSONB NOT NULL,

    CONSTRAINT "recovery_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_updates" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '⚕️',
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_milestones" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "booking_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stay_or_go_templates_procedure_homeCountry_key" ON "stay_or_go_templates"("procedure", "homeCountry");

-- CreateIndex
CREATE UNIQUE INDEX "trip_plan_templates_procedure_destination_key" ON "trip_plan_templates"("procedure", "destination");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_plans_name_key" ON "insurance_plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_protocols_procedure_key" ON "recovery_protocols"("procedure");

-- AddForeignKey
ALTER TABLE "booking_status_updates" ADD CONSTRAINT "booking_status_updates_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_milestones" ADD CONSTRAINT "booking_milestones_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
