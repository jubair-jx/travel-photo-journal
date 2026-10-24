-- Existing rows each become their own session: the default gives every row a distinct id.
-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "session_started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_session_id_idx" ON "refresh_tokens"("user_id", "session_id");
