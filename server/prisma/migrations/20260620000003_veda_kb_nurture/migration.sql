-- CreateEnum
CREATE TYPE "NurtureStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'STOPPED');

-- CreateTable
CREATE TABLE "VedaKnowledge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "embedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VedaKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurtureEnrollment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sequenceKey" TEXT NOT NULL DEFAULT 'default',
    "status" "NurtureStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastStepAt" TIMESTAMP(3),
    "stoppedReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurtureEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VedaKnowledge_active_idx" ON "VedaKnowledge"("active");

-- CreateIndex
CREATE UNIQUE INDEX "NurtureEnrollment_leadId_key" ON "NurtureEnrollment"("leadId");

-- CreateIndex
CREATE INDEX "NurtureEnrollment_status_nextRunAt_idx" ON "NurtureEnrollment"("status", "nextRunAt");

-- AddForeignKey
ALTER TABLE "NurtureEnrollment" ADD CONSTRAINT "NurtureEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
