-- Live hospital chat (patient ↔ Curify staff on the hospital's behalf), stored
-- as a JSON message log on the journey.
ALTER TABLE "journeys" ADD COLUMN "hospitalChat" JSONB;
