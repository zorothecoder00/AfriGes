-- AlterTable
ALTER TABLE "LigneReceptionAppro" ADD COLUMN     "lotId" INTEGER;

-- CreateIndex
CREATE INDEX "LigneReceptionAppro_lotId_idx" ON "LigneReceptionAppro"("lotId");

-- CreateIndex
CREATE INDEX "LotProduit_receptionApproId_idx" ON "LotProduit"("receptionApproId");

-- AddForeignKey
ALTER TABLE "LotProduit" ADD CONSTRAINT "LotProduit_receptionApproId_fkey" FOREIGN KEY ("receptionApproId") REFERENCES "ReceptionApprovisionnement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReceptionAppro" ADD CONSTRAINT "LigneReceptionAppro_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LotProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
