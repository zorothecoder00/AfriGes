-- AlterTable
ALTER TABLE "TaxeConfig" ADD COLUMN     "conditionCategorieId" INTEGER,
ADD COLUMN     "conditionFamilleId" INTEGER,
ADD COLUMN     "conditionPointDeVenteId" INTEGER,
ADD COLUMN     "priorite" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "TaxeConfig_nature_idx" ON "TaxeConfig"("nature");

-- CreateIndex
CREATE INDEX "TaxeConfig_actif_idx" ON "TaxeConfig"("actif");

-- AddForeignKey
ALTER TABLE "TaxeConfig" ADD CONSTRAINT "TaxeConfig_conditionCategorieId_fkey" FOREIGN KEY ("conditionCategorieId") REFERENCES "CategorieProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxeConfig" ADD CONSTRAINT "TaxeConfig_conditionFamilleId_fkey" FOREIGN KEY ("conditionFamilleId") REFERENCES "FamilleProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxeConfig" ADD CONSTRAINT "TaxeConfig_conditionPointDeVenteId_fkey" FOREIGN KEY ("conditionPointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
