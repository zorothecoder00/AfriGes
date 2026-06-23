-- AlterTable
ALTER TABLE "RemboursementCredit" ADD COLUMN     "agentCollecteurId" INTEGER,
ADD COLUMN     "montantAttendu" DECIMAL(65,30),
ADD COLUMN     "numeroJour" INTEGER;

-- CreateIndex
CREATE INDEX "RemboursementCredit_agentCollecteurId_idx" ON "RemboursementCredit"("agentCollecteurId");

-- AddForeignKey
ALTER TABLE "RemboursementCredit" ADD CONSTRAINT "RemboursementCredit_agentCollecteurId_fkey" FOREIGN KEY ("agentCollecteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
