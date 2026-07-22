-- Persist a report's source documents so its analysis can be re-run, and so a
-- follow-up upload is analysed together with the earlier reports rather than alone.
-- Paths point at the gitignored uploads/reports dir (never served statically).
ALTER TABLE "reports" ADD COLUMN "docPaths" JSONB;

-- Re-runs of this report's analysis, capped in code (MAX_REANALYSIS).
ALTER TABLE "reports" ADD COLUMN "reanalysisCount" INTEGER NOT NULL DEFAULT 0;
