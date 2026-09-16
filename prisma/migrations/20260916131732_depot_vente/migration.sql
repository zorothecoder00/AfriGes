-- CreateEnum
CREATE TYPE "StatutConventionDepotVente" AS ENUM ('ACTIVE', 'SUSPENDUE', 'TERMINEE');

-- CreateEnum
CREATE TYPE "StatutDepotMarchandise" AS ENUM ('BROUILLON', 'EN_STOCK', 'CLOTURE');

-- CreateEnum
CREATE TYPE "StatutReglementDepotVente" AS ENUM ('BROUILLON', 'SOUMIS', 'REGLE');

-- AlterEnum
ALTER TYPE "TypeEntreeStock" ADD VALUE 'DEPOT_VENTE';

-- AlterTable
ALTER TABLE "FicheDecaissement" ADD COLUMN     "reglementDepotVenteId" INTEGER;

-- CreateTable
CREATE TABLE "ConventionDepotVente" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutConventionDepotVente" NOT NULL DEFAULT 'ACTIVE',
    "fournisseurId" INTEGER NOT NULL,
    "commissionPourcent" DECIMAL(65,30) NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "dureeMaxInvenduJours" INTEGER,
    "conditions" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConventionDepotVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepotMarchandise" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutDepotMarchandise" NOT NULL DEFAULT 'BROUILLON',
    "conventionId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "dateDepot" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entreeParId" INTEGER,
    "dateEntree" TIMESTAMP(3),
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepotMarchandise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneDepotMarchandise" (
    "id" SERIAL NOT NULL,
    "depotId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantiteDeposee" INTEGER NOT NULL,
    "prixVenteConvenu" DECIMAL(65,30) NOT NULL,
    "dlc" TIMESTAMP(3),
    "lotProduitId" INTEGER,
    "quantiteReprise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneDepotMarchandise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglementDepotVente" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutReglementDepotVente" NOT NULL DEFAULT 'BROUILLON',
    "conventionId" INTEGER NOT NULL,
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "montantVentesBrut" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantCommission" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantDu" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "demandeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglementDepotVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneReglementDepotVente" (
    "id" SERIAL NOT NULL,
    "reglementId" INTEGER NOT NULL,
    "ligneDepotId" INTEGER NOT NULL,
    "quantiteVendue" INTEGER NOT NULL,
    "montantBrut" DECIMAL(65,30) NOT NULL,
    "montantCommission" DECIMAL(65,30) NOT NULL,
    "montantNet" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneReglementDepotVente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConventionDepotVente_reference_key" ON "ConventionDepotVente"("reference");

-- CreateIndex
CREATE INDEX "ConventionDepotVente_fournisseurId_idx" ON "ConventionDepotVente"("fournisseurId");

-- CreateIndex
CREATE INDEX "ConventionDepotVente_statut_idx" ON "ConventionDepotVente"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "DepotMarchandise_reference_key" ON "DepotMarchandise"("reference");

-- CreateIndex
CREATE INDEX "DepotMarchandise_conventionId_idx" ON "DepotMarchandise"("conventionId");

-- CreateIndex
CREATE INDEX "DepotMarchandise_pointDeVenteId_idx" ON "DepotMarchandise"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "DepotMarchandise_statut_idx" ON "DepotMarchandise"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "LigneDepotMarchandise_lotProduitId_key" ON "LigneDepotMarchandise"("lotProduitId");

-- CreateIndex
CREATE INDEX "LigneDepotMarchandise_depotId_idx" ON "LigneDepotMarchandise"("depotId");

-- CreateIndex
CREATE UNIQUE INDEX "ReglementDepotVente_reference_key" ON "ReglementDepotVente"("reference");

-- CreateIndex
CREATE INDEX "ReglementDepotVente_conventionId_idx" ON "ReglementDepotVente"("conventionId");

-- CreateIndex
CREATE INDEX "ReglementDepotVente_statut_idx" ON "ReglementDepotVente"("statut");

-- CreateIndex
CREATE INDEX "LigneReglementDepotVente_reglementId_idx" ON "LigneReglementDepotVente"("reglementId");

-- AddForeignKey
ALTER TABLE "ConventionDepotVente" ADD CONSTRAINT "ConventionDepotVente_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConventionDepotVente" ADD CONSTRAINT "ConventionDepotVente_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotMarchandise" ADD CONSTRAINT "DepotMarchandise_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "ConventionDepotVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotMarchandise" ADD CONSTRAINT "DepotMarchandise_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotMarchandise" ADD CONSTRAINT "DepotMarchandise_entreeParId_fkey" FOREIGN KEY ("entreeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotMarchandise" ADD CONSTRAINT "DepotMarchandise_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDepotMarchandise" ADD CONSTRAINT "LigneDepotMarchandise_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "DepotMarchandise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDepotMarchandise" ADD CONSTRAINT "LigneDepotMarchandise_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDepotMarchandise" ADD CONSTRAINT "LigneDepotMarchandise_lotProduitId_fkey" FOREIGN KEY ("lotProduitId") REFERENCES "LotProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglementDepotVente" ADD CONSTRAINT "ReglementDepotVente_conventionId_fkey" FOREIGN KEY ("conventionId") REFERENCES "ConventionDepotVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglementDepotVente" ADD CONSTRAINT "ReglementDepotVente_demandeParId_fkey" FOREIGN KEY ("demandeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReglementDepotVente" ADD CONSTRAINT "LigneReglementDepotVente_reglementId_fkey" FOREIGN KEY ("reglementId") REFERENCES "ReglementDepotVente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReglementDepotVente" ADD CONSTRAINT "LigneReglementDepotVente_ligneDepotId_fkey" FOREIGN KEY ("ligneDepotId") REFERENCES "LigneDepotMarchandise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_reglementDepotVenteId_fkey" FOREIGN KEY ("reglementDepotVenteId") REFERENCES "ReglementDepotVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
