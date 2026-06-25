-- CreateEnum
CREATE TYPE "VedaGapStatus" AS ENUM ('OPEN', 'ANSWERED', 'PENDING', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "VedaKnowledgeGap" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "channel" TEXT,
    "conversationId" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" "VedaGapStatus" NOT NULL DEFAULT 'OPEN',
    "capturedAnswer" TEXT,
    "draftTitle" TEXT,
    "draftContent" TEXT,
    "draftCategory" TEXT,
    "knowledgeId" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "VedaKnowledgeGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VedaKnowledgeGap_status_idx" ON "VedaKnowledgeGap"("status");

-- CreateIndex
CREATE INDEX "VedaKnowledgeGap_normalized_idx" ON "VedaKnowledgeGap"("normalized");
