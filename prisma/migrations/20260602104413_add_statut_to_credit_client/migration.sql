-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutVenteDirecte" ADD VALUE 'CREDIT_EN_LIVRAISON';
ALTER TYPE "StatutVenteDirecte" ADD VALUE 'CREDIT_LIVRE';

-- DropForeignKey
ALTER TABLE "LigneVenteDirecte" DROP CONSTRAINT "LigneVenteDirecte_produitId_fkey";

-- AlterTable
ALTER TABLE "CreditClient" ADD COLUMN     "montantConsomme" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LigneVenteDirecte" ADD COLUMN     "produitNom" TEXT,
ALTER COLUMN "produitId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VenteDirecte" ADD COLUMN     "creditClientId" INTEGER;

-- CreateIndex
CREATE INDEX "VenteDirecte_creditClientId_idx" ON "VenteDirecte"("creditClientId");

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_creditClientId_fkey" FOREIGN KEY ("creditClientId") REFERENCES "CreditClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVenteDirecte" ADD CONSTRAINT "LigneVenteDirecte_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
