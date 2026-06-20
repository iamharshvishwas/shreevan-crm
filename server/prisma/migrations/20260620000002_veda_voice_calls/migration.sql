-- Veda AI voice-call fields on DiscoveryCall (Phase 3)
ALTER TABLE "DiscoveryCall" ADD COLUMN "externalCallId" TEXT;
ALTER TABLE "DiscoveryCall" ADD COLUMN "recordingUrl" TEXT;
ALTER TABLE "DiscoveryCall" ADD COLUMN "transcriptRedacted" TEXT;
ALTER TABLE "DiscoveryCall" ADD COLUMN "summary" TEXT;
