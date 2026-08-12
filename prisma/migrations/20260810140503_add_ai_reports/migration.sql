-- CreateTable
CREATE TABLE "AiReport" (
    "id" SERIAL NOT NULL,
    "internId" INTEGER NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallScore" INTEGER NOT NULL,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "suggestions" TEXT[],
    "adminSummary" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_internId_fkey" FOREIGN KEY ("internId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
