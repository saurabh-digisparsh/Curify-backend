-- Review.reviewDate: String -> DateTime.
-- Existing values are free-text ("Aug 15, 2024", ISO, or relative like "2 months ago").
-- Cast in-place via a best-effort parser: absolute dates convert, anything Postgres
-- can't parse becomes NULL instead of aborting the migration.
CREATE OR REPLACE FUNCTION pg_temp.safe_review_ts(txt text) RETURNS timestamp(3) AS $$
BEGIN
  IF txt IS NULL OR btrim(txt) = '' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(txt)::timestamp(3);
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "reviews"
  ALTER COLUMN "reviewDate" TYPE timestamp(3)
  USING pg_temp.safe_review_ts("reviewDate");
