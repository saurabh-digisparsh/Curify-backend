-- CreateTable: per-patient "Generate My Trip" service-step progress
-- (visa/flight/hotel/cab + internal quotation). Deep-links are recomputed on
-- read, so only status/proof/validation are persisted here.
CREATE TABLE "trip_service_steps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "proofPath" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_service_steps_pkey" PRIMARY KEY ("id")
);

-- One step of each type per patient+hospital trip.
CREATE UNIQUE INDEX "trip_service_steps_userId_hospitalId_type_key" ON "trip_service_steps"("userId", "hospitalId", "type");

-- Cascade: deleting a user removes their trip steps (right-to-erasure).
ALTER TABLE "trip_service_steps" ADD CONSTRAINT "trip_service_steps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
