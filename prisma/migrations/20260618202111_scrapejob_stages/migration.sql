-- Add per-stage breakdown column for combined ('full') scrape jobs.
ALTER TABLE "scrape_jobs" ADD COLUMN "stages" JSONB;
