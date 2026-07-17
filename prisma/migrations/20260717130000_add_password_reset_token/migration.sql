-- Password reset: emailed single-use tokenised link, short-lived (1h).
ALTER TABLE "users" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "users" ADD COLUMN "resetTokenExp" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");
