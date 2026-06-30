-- CreateEnum
CREATE TYPE "LiveClassStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveClass" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "LiveClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "hmsRoomId" TEXT,
    "hostId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassMessage" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "participantId" TEXT,
    "authorName" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_email_key" ON "Participant"("email");

-- CreateIndex
CREATE INDEX "Participant_email_idx" ON "Participant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LiveClass_slug_key" ON "LiveClass"("slug");

-- CreateIndex
CREATE INDEX "LiveClass_status_idx" ON "LiveClass"("status");

-- CreateIndex
CREATE INDEX "LiveClass_hostId_idx" ON "LiveClass"("hostId");

-- CreateIndex
CREATE INDEX "ClassMessage_classId_createdAt_idx" ON "ClassMessage"("classId", "createdAt");

-- CreateIndex
CREATE INDEX "Poll_classId_idx" ON "Poll"("classId");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_idx" ON "PollVote"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_participantId_key" ON "PollVote"("pollId", "participantId");

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMessage" ADD CONSTRAINT "ClassMessage_classId_fkey" FOREIGN KEY ("classId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMessage" ADD CONSTRAINT "ClassMessage_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_classId_fkey" FOREIGN KEY ("classId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
