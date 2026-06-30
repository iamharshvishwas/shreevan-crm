-- DropForeignKey
ALTER TABLE "LiveClass" DROP CONSTRAINT "LiveClass_hostId_fkey";

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_email_key" ON "Instructor"("email");

-- CreateIndex
CREATE INDEX "Instructor_email_idx" ON "Instructor"("email");

-- AddForeignKey
ALTER TABLE "LiveClass" ADD CONSTRAINT "LiveClass_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
