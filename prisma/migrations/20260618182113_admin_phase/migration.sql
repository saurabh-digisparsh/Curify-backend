-- Rename Role enum value PATIENT -> USER (preserves existing rows & default), add AGENT.
-- Using RENAME VALUE avoids dropping the enum, which would fail on rows still using PATIENT.
ALTER TYPE "Role" RENAME VALUE 'PATIENT' TO 'USER';
ALTER TYPE "Role" ADD VALUE 'AGENT';

-- Keep the column default aligned with the schema (@default(USER)).
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';

-- Botasaurus scrape jobs --------------------------------------------------------
CREATE TYPE "ScrapeStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE "scrape_jobs" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "params" JSONB,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'PENDING',
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "logPath" TEXT,
    "output" TEXT,
    "error" TEXT,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id")
);
