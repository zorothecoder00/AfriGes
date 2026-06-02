-- AlterTable
ALTER TABLE "LigneSouscriptionProduit" ADD COLUMN     "pointDeVenteId" INTEGER;

-- CreateIndex
CREATE INDEX "LigneSouscriptionProduit_pointDeVenteId_statut_idx" ON "LigneSouscriptionProduit"("pointDeVenteId", "statut");

-- AddForeignKey
ALTER TABLE "LigneSouscriptionProduit" ADD CONSTRAINT "LigneSouscriptionProduit_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
