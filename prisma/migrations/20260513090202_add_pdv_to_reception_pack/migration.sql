-- AlterTable
ALTER TABLE "ReceptionProduitPack" ADD COLUMN     "pointDeVenteId" INTEGER;

-- CreateIndex
CREATE INDEX "ReceptionProduitPack_pointDeVenteId_idx" ON "ReceptionProduitPack"("pointDeVenteId");

-- AddForeignKey
ALTER TABLE "ReceptionProduitPack" ADD CONSTRAINT "ReceptionProduitPack_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
