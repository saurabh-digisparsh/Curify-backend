-- Guest-account flow removed (auto-guest chat accounts + /auth/upgrade).
-- Drop the flag column. Existing guest rows (email @guest.curify.internal,
-- unverified, random password) are inert and can log in via no path; delete
-- them separately if you want them purged (that cascades to their journeys).
ALTER TABLE "users" DROP COLUMN "isGuest";
