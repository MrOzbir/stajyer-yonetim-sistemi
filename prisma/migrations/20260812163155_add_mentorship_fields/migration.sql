/*
  Warnings:

  - Added the required column `internFeedback` to the `AiReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `internSummary` to the `AiReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AiReport" ADD COLUMN     "encouragementQuote" TEXT,
ADD COLUMN     "internFeedback" TEXT NOT NULL,
ADD COLUMN     "internSummary" TEXT NOT NULL,
ADD COLUMN     "learningResources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nextSteps" TEXT[] DEFAULT ARRAY[]::TEXT[];
