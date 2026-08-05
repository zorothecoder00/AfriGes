-- AlterTable
ALTER TABLE "PropositionImputationOCR" ADD COLUMN     "compteTvaProbable" TEXT,
ADD COLUMN     "journalProbable" TEXT,
ADD COLUMN     "sectionAnalytiqueProbableId" INTEGER;

-- AddForeignKey
ALTER TABLE "PropositionImputationOCR" ADD CONSTRAINT "PropositionImputationOCR_sectionAnalytiqueProbableId_fkey" FOREIGN KEY ("sectionAnalytiqueProbableId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;
