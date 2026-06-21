-- Live-chat agent controls on Conversation
ALTER TABLE "Conversation" ADD COLUMN "handoverToHuman" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "needsAttention" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "attentionReason" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_channel_idx" ON "Conversation"("channel");
