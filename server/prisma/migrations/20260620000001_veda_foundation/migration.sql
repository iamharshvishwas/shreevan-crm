-- CreateEnum
CREATE TYPE "VedaApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'AUTO_SENT');

-- CreateTable
CREATE TABLE "VedaApproval" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "VedaApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "draftText" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "context" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VedaApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VedaActionLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "approvalId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "costUsdMicro" INTEGER,
    "durationMs" INTEGER,
    "killedBySwitch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VedaActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VedaApproval_status_idx" ON "VedaApproval"("status");

-- CreateIndex
CREATE INDEX "VedaApproval_entityType_entityId_idx" ON "VedaApproval"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "VedaActionLog_entityType_entityId_idx" ON "VedaActionLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "VedaActionLog_type_idx" ON "VedaActionLog"("type");

-- CreateIndex
CREATE INDEX "VedaActionLog_createdAt_idx" ON "VedaActionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "VedaActionLog" ADD CONSTRAINT "VedaActionLog_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "VedaApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
