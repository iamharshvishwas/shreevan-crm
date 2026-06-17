-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RELATIONSHIP', 'MARKETING', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'EMAIL', 'WEBSITE_FORM', 'WEBSITE_CHAT', 'PHONE', 'WALKIN', 'REFERRAL', 'GOOGLE_BUSINESS');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEEDS_REPLY', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'SPAM');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "SlaState" AS ENUM ('NONE', 'ON_TRACK', 'WARNING', 'BREACHED', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('RECEIVED', 'SENT', 'LOGGED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "Temperature" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'SIMULATED', 'TOKEN_EXPIRING', 'DISCONNECTED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "InboundEventStatus" AS ENUM ('PROCESSED', 'DUPLICATE', 'FAILED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'INR');

-- CreateEnum
CREATE TYPE "HealthScreeningStatus" AS ENUM ('REQUIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'DEPOSIT', 'PAID_IN_FULL');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'WELCOME_PACK_PENDING', 'TRAVEL_PENDING', 'SCREENING_COMPLETED', 'READY');

-- CreateEnum
CREATE TYPE "MergeStatus" AS ENUM ('PENDING', 'DISMISSED', 'MERGED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RELATIONSHIP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "timezone" TEXT,
    "language" TEXT,
    "preferredContact" TEXT,
    "firstTouchSource" "Channel" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactIdentity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "handle" TEXT NOT NULL,
    "normalizedHandle" TEXT NOT NULL,
    "displayName" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMergeSuggestion" (
    "id" TEXT NOT NULL,
    "contactAId" TEXT NOT NULL,
    "contactBId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" TEXT[],
    "status" "MergeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMergeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMergeAudit" (
    "id" TEXT NOT NULL,
    "keptContactId" TEXT NOT NULL,
    "mergedContactId" TEXT NOT NULL,
    "actorId" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMergeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "detail" TEXT,
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "secretRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "Channel" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "externalConversationId" TEXT,
    "status" "InboundEventStatus" NOT NULL DEFAULT 'PROCESSED',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB NOT NULL,
    "normalized" JSONB,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "channel" "Channel" NOT NULL,
    "contactId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "externalConversationId" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "channel" "Channel" NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "delivery" "DeliveryState" NOT NULL DEFAULT 'RECEIVED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT,
    "sizeBytes" INTEGER,
    "contentType" TEXT,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEEDS_REPLY',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "channel" "Channel" NOT NULL,
    "firstTouchSource" "Channel" NOT NULL,
    "ownerId" TEXT,
    "slaPolicyId" TEXT,
    "firstRespondedAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "programInterest" TEXT,
    "expectedValueAmount" INTEGER,
    "expectedValueCurrency" "Currency",
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "leadId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryTag" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "EnquiryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryAssignmentHistory" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "byUserId" TEXT,
    "toOwnerId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT,
    "leadId" TEXT,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "firstResponseMins" INTEGER NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "pauseWhenWaitingCustomer" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaEvent" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingRule" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "whenCountry" TEXT,
    "whenChannel" "Channel",
    "assignToUserId" TEXT,
    "priorityOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isTerminalWon" BOOLEAN NOT NULL DEFAULT false,
    "isTerminalLost" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadLostReason" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "LeadLostReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "temperature" "Temperature" NOT NULL DEFAULT 'WARM',
    "ownerId" TEXT,
    "programInterest" TEXT,
    "preferredDates" TEXT,
    "participants" INTEGER NOT NULL DEFAULT 1,
    "expectedValueAmount" INTEGER,
    "expectedValueCurrency" "Currency",
    "decisionDate" TIMESTAMP(3),
    "firstTouchSource" "Channel" NOT NULL,
    "healthScreening" "HealthScreeningStatus",
    "eligibility" "EligibilityStatus",
    "lostReasonId" TEXT,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "closedLostAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStageHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "byUserId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadOwnerHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromOwnerId" TEXT,
    "toOwnerId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadOwnerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "byUserId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "enquiryId" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryCall" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "enquiryId" TEXT,
    "leadId" TEXT,
    "ownerId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER,
    "timezone" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'SCHEDULED',
    "prepNotes" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER,
    "priceUsdAmount" INTEGER,
    "priceInrAmount" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "descriptor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramCohort" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "cohortId" TEXT,
    "valueAmount" INTEGER NOT NULL,
    "valueCurrency" "Currency" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmedCustomer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfirmedCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Contact_country_idx" ON "Contact"("country");

-- CreateIndex
CREATE INDEX "ContactIdentity_contactId_idx" ON "ContactIdentity"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactIdentity_channel_normalizedHandle_key" ON "ContactIdentity"("channel", "normalizedHandle");

-- CreateIndex
CREATE UNIQUE INDEX "ContactMergeSuggestion_contactAId_contactBId_key" ON "ContactMergeSuggestion"("contactAId", "contactBId");

-- CreateIndex
CREATE INDEX "InboundEvent_status_idx" ON "InboundEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_connectionId_externalEventId_key" ON "InboundEvent"("connectionId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_connectionId_externalMessageId_key" ON "InboundEvent"("connectionId", "externalMessageId");

-- CreateIndex
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

-- CreateIndex
CREATE INDEX "Conversation_enquiryId_idx" ON "Conversation"("enquiryId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_leadId_key" ON "Enquiry"("leadId");

-- CreateIndex
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");

-- CreateIndex
CREATE INDEX "Enquiry_ownerId_idx" ON "Enquiry"("ownerId");

-- CreateIndex
CREATE INDEX "Enquiry_channel_idx" ON "Enquiry"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryTag_enquiryId_tag_key" ON "EnquiryTag"("enquiryId", "tag");

-- CreateIndex
CREATE INDEX "EnquiryAssignmentHistory_enquiryId_idx" ON "EnquiryAssignmentHistory"("enquiryId");

-- CreateIndex
CREATE INDEX "InternalNote_enquiryId_idx" ON "InternalNote"("enquiryId");

-- CreateIndex
CREATE INDEX "InternalNote_leadId_idx" ON "InternalNote"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_key_key" ON "SlaPolicy"("key");

-- CreateIndex
CREATE INDEX "SlaEvent_enquiryId_idx" ON "SlaEvent"("enquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaEvent_enquiryId_type_key" ON "SlaEvent"("enquiryId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_key_key" ON "PipelineStage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LeadLostReason_key_key" ON "LeadLostReason"("key");

-- CreateIndex
CREATE INDEX "Lead_stageId_idx" ON "Lead"("stageId");

-- CreateIndex
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");

-- CreateIndex
CREATE INDEX "LeadStageHistory_leadId_idx" ON "LeadStageHistory"("leadId");

-- CreateIndex
CREATE INDEX "LeadOwnerHistory_leadId_idx" ON "LeadOwnerHistory"("leadId");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_ownerId_idx" ON "Task"("ownerId");

-- CreateIndex
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");

-- CreateIndex
CREATE INDEX "DiscoveryCall_scheduledAt_idx" ON "DiscoveryCall"("scheduledAt");

-- CreateIndex
CREATE INDEX "DiscoveryCall_status_idx" ON "DiscoveryCall"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Program_key_key" ON "Program"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_leadId_key" ON "Booking"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmedCustomer_bookingId_key" ON "ConfirmedCustomer"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfirmedCustomer_contactId_key" ON "ConfirmedCustomer"("contactId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_idx" ON "OutboxEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryTag" ADD CONSTRAINT "EnquiryTag_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryAssignmentHistory" ADD CONSTRAINT "EnquiryAssignmentHistory_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaEvent" ADD CONSTRAINT "SlaEvent_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lostReasonId_fkey" FOREIGN KEY ("lostReasonId") REFERENCES "LeadLostReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageHistory" ADD CONSTRAINT "LeadStageHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageHistory" ADD CONSTRAINT "LeadStageHistory_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageHistory" ADD CONSTRAINT "LeadStageHistory_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOwnerHistory" ADD CONSTRAINT "LeadOwnerHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCall" ADD CONSTRAINT "DiscoveryCall_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCall" ADD CONSTRAINT "DiscoveryCall_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCall" ADD CONSTRAINT "DiscoveryCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCall" ADD CONSTRAINT "DiscoveryCall_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCohort" ADD CONSTRAINT "ProgramCohort_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "ProgramCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCustomer" ADD CONSTRAINT "ConfirmedCustomer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCustomer" ADD CONSTRAINT "ConfirmedCustomer_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

