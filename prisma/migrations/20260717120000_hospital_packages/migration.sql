-- Treatment packages with a per-package price: [{ name, priceUsd, included[], notes }].
-- Additive and nullable: `procedures` stays the flat name list every existing
-- reader (patient matching, comparison card) uses, so NULL here simply means
-- "no per-package prices — fall back to quotedPriceUsd".
ALTER TABLE "hospital_applications" ADD COLUMN IF NOT EXISTS "packages" JSONB;
ALTER TABLE "hospitals" ADD COLUMN IF NOT EXISTS "packages" JSONB;
