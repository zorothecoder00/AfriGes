-- Position GPS de la prise de commande + produits hors catalogue sur les lignes de commande client.
ALTER TABLE "CommandeClient"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "precisionGps" DOUBLE PRECISION;

ALTER TABLE "LigneCommandeClient"
  ALTER COLUMN "produitId" DROP NOT NULL,
  ADD COLUMN "designationLibre" TEXT;

-- La clé étrangère devient facultative : ON DELETE SET NULL (comportement Prisma d'une relation optionnelle).
ALTER TABLE "LigneCommandeClient" DROP CONSTRAINT "LigneCommandeClient_produitId_fkey";
ALTER TABLE "LigneCommandeClient" ADD CONSTRAINT "LigneCommandeClient_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
