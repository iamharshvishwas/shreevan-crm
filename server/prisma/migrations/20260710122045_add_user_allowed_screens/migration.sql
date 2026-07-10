-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowedScreens" TEXT[] DEFAULT ARRAY[]::TEXT[];
