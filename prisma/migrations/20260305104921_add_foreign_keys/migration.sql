/*
  Warnings:

  - A unique constraint covering the columns `[sessionId,pointDeVenteId]` on the table `ClotureCaisse` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatutBonSortie" AS ENUM ('BROUILLON', 'VALIDE', 'ANNULE');

-- DropIndex
DROP INDEX "ClotureCaisse_date_key";

-- DropIndex
DROP INDEX "GestionnaireAffectation_userId_pointDeVenteId_key";

-- AlterTable
ALTER TABLE "MouvementStock" ADD COLUMN     "bonSortieId" INTEGER;

-- CreateTable
CREATE TABLE "BonSortie" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "typeSortie" "TypeSortieStock" NOT NULL,
    "statut" "StatutBonSortie" NOT NULL DEFAULT 'BROUILLON',
    "pointDeVenteId" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonSortie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonSortie" (
    "id" SERIAL NOT NULL,
    "bonSortieId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnit" DECIMAL(65,30),

    CONSTRAINT "LigneBonSortie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonSortie_reference_key" ON "BonSortie"("reference");

-- CreateIndex
CREATE INDEX "BonSortie_statut_idx" ON "BonSortie"("statut");

-- CreateIndex
CREATE INDEX "BonSortie_pointDeVenteId_idx" ON "BonSortie"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "BonSortie_typeSortie_idx" ON "BonSortie"("typeSortie");

-- CreateIndex
CREATE UNIQUE INDEX "ClotureCaisse_sessionId_pointDeVenteId_key" ON "ClotureCaisse"("sessionId", "pointDeVenteId");

-- CreateIndex
CREATE INDEX "GestionnaireAffectation_userId_pointDeVenteId_actif_idx" ON "GestionnaireAffectation"("userId", "pointDeVenteId", "actif");

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionApprovisionnement" ADD CONSTRAINT "ReceptionApprovisionnement_origineId_fkey" FOREIGN KEY ("origineId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonSortie" ADD CONSTRAINT "BonSortie_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonSortie" ADD CONSTRAINT "BonSortie_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonSortie" ADD CONSTRAINT "BonSortie_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonSortie" ADD CONSTRAINT "LigneBonSortie_bonSortieId_fkey" FOREIGN KEY ("bonSortieId") REFERENCES "BonSortie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonSortie" ADD CONSTRAINT "LigneBonSortie_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalieStock" ADD CONSTRAINT "AnomalieStock_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCaisse" ADD CONSTRAINT "SessionCaisse_caissierId_fkey" FOREIGN KEY ("caissierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaissePDV" ADD CONSTRAINT "CaissePDV_rpvId_fkey" FOREIGN KEY ("rpvId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationCaissePDV" ADD CONSTRAINT "OperationCaissePDV_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationCaisse" ADD CONSTRAINT "OperationCaisse_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertCaisse" ADD CONSTRAINT "TransfertCaisse_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_sessionCaisseId_fkey" FOREIGN KEY ("sessionCaisseId") REFERENCES "SessionCaisse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
