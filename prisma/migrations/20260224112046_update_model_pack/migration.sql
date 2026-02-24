-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "produitCibleId" INTEGER;

-- AlterTable
ALTER TABLE "SouscriptionPack" ADD COLUMN     "frequenceVersement" "FrequenceVersement";

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_produitCibleId_fkey" FOREIGN KEY ("produitCibleId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
