-- Admin visibility kill-switch for a hospital. Default true so every existing row
-- (scraped + approved onboarded) keeps its current patient-facing visibility.
ALTER TABLE "hospitals" ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;
