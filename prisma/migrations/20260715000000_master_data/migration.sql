-- CreateTable
CREATE TABLE "master_specialties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_qualifications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_languages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_timezones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "master_timezones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_specialties_name_key" ON "master_specialties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "master_qualifications_name_key" ON "master_qualifications"("name");

-- CreateIndex
CREATE UNIQUE INDEX "master_languages_name_key" ON "master_languages"("name");

-- CreateIndex
CREATE UNIQUE INDEX "master_timezones_name_key" ON "master_timezones"("name");

