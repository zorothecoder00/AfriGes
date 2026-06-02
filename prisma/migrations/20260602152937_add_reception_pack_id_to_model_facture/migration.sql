-- AlterTable
ALTER TABLE "FactureVente" ADD COLUMN     "receptionPackId" INTEGER;

-- CreateIndex
CREATE INDEX "FactureVente_receptionPackId_idx" ON "FactureVente"("receptionPackId");

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_receptionPackId_fkey" FOREIGN KEY ("receptionPackId") REFERENCES "ReceptionProduitPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
