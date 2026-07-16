-- AlterTable
ALTER TABLE "hospital_applications" ADD COLUMN     "sessionToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "hospital_applications_sessionToken_key" ON "hospital_applications"("sessionToken");

