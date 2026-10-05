-- DropForeignKey
ALTER TABLE "LigneDevisProforma" DROP CONSTRAINT "LigneDevisProforma_produitId_fkey";

-- AlterTable
ALTER TABLE "LigneDevisProforma" ADD COLUMN     "designationLibre" TEXT,
ALTER COLUMN "produitId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LigneDevisProforma" ADD CONSTRAINT "LigneDevisProforma_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

