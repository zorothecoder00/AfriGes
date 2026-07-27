-- AlterEnum
ALTER TYPE "TypePointDeVente" ADD VALUE 'PLATEFORME_REGIONALE';

-- AlterTable
ALTER TABLE "PointDeVente" ADD COLUMN     "capaciteStockage" DECIMAL(65,30),
ADD COLUMN     "capaciteUnite" TEXT DEFAULT 'm3',
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "plateformeRegionaleId" INTEGER,
ADD COLUMN     "seuilSecuriteGlobal" DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "PointDeVente_plateformeRegionaleId_idx" ON "PointDeVente"("plateformeRegionaleId");

-- AddForeignKey
ALTER TABLE "PointDeVente" ADD CONSTRAINT "PointDeVente_plateformeRegionaleId_fkey" FOREIGN KEY ("plateformeRegionaleId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
