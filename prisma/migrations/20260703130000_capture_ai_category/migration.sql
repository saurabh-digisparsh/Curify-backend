-- Phase 4: preserve the model's own prediction separately from the (human-overwritten) gold
-- category, so the classification scorecard can compute a confusion matrix. Additive, nullable.
ALTER TABLE "source_captures" ADD COLUMN "aiCategory" "LeadCategory";
