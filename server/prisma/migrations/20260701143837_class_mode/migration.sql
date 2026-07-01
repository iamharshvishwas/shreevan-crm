-- CreateEnum
CREATE TYPE "LiveClassMode" AS ENUM ('WEBINAR', 'MEETING');

-- AlterTable
ALTER TABLE "LiveClass" ADD COLUMN     "mode" "LiveClassMode" NOT NULL DEFAULT 'WEBINAR';
