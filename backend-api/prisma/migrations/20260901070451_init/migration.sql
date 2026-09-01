/*
  Warnings:

  - You are about to drop the `DailyArchive` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[resetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "DailyArchive" DROP CONSTRAINT "DailyArchive_internId_fkey";

-- AlterTable
ALTER TABLE "DailyLog" ADD COLUMN     "nextDayQuote" TEXT,
ADD COLUMN     "nextDayTip" TEXT;

-- AlterTable
ALTER TABLE "InternProfile" ADD COLUMN     "notificationEmail" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "readAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- DropTable
DROP TABLE "DailyArchive";

-- CreateTable
CREATE TABLE "DailyArchiveEntry" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "internId" INTEGER NOT NULL,
    "mood" TEXT NOT NULL,
    "topicsCovered" TEXT[],
    "challengesFaced" TEXT[],
    "socialInteractions" TEXT[],
    "sentimentScore" INTEGER NOT NULL,

    CONSTRAINT "DailyArchiveEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generalMoral" TEXT NOT NULL,
    "challenges" TEXT[],
    "achievements" TEXT[],
    "complaints" TEXT[],
    "satisfactions" TEXT[],
    "executiveSummary" TEXT NOT NULL,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- AddForeignKey
ALTER TABLE "DailyArchiveEntry" ADD CONSTRAINT "DailyArchiveEntry_internId_fkey" FOREIGN KEY ("internId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
