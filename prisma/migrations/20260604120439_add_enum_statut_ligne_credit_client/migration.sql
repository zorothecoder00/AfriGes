-- CreateEnum
CREATE TYPE "StatutLigneCreditClient" AS ENUM ('EN_ATTENTE', 'LIVRE', 'INDISPONIBLE', 'SUBSTITUE', 'ANNULE');

-- AlterTable
ALTER TABLE "LigneCreditClient" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateTraitement" TIMESTAMP(3),
ADD COLUMN     "estNouveauProduit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pointDeVenteId" INTEGER,
ADD COLUMN     "produitNomSaisi" TEXT,
ADD COLUMN     "produitSubstitutId" INTEGER,
ADD COLUMN     "statut" "StatutLigneCreditClient" NOT NULL DEFAULT 'EN_ATTENTE',
ADD COLUMN     "traiteParId" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "LigneCreditClient_pointDeVenteId_statut_idx" ON "LigneCreditClient"("pointDeVenteId", "statut");

-- CreateIndex
CREATE INDEX "LigneCreditClient_statut_idx" ON "LigneCreditClient"("statut");

-- AddForeignKey
ALTER TABLE "LigneCreditClient" ADD CONSTRAINT "LigneCreditClient_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCreditClient" ADD CONSTRAINT "LigneCreditClient_produitSubstitutId_fkey" FOREIGN KEY ("produitSubstitutId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCreditClient" ADD CONSTRAINT "LigneCreditClient_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
