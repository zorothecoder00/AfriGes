-- CreateEnum
CREATE TYPE "StatutProfilRevendeur" AS ENUM ('ACTIF', 'SUSPENDU', 'RESILIE');

-- CreateEnum
CREATE TYPE "StatutCommandeRevendeur" AS ENUM ('BROUILLON', 'CONFIRMEE', 'LIVREE', 'FACTUREE', 'ANNULEE');

-- AlterEnum
ALTER TYPE "TypeFactureVente" ADD VALUE 'REVENDEUR';

-- AlterTable
ALTER TABLE "FactureVente" ADD COLUMN     "revendeurId" INTEGER;

-- CreateTable
CREATE TABLE "ProfilRevendeur" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "statut" "StatutProfilRevendeur" NOT NULL DEFAULT 'ACTIF',
    "raisonSociale" TEXT NOT NULL,
    "nomCommercial" TEXT,
    "nif" TEXT,
    "rccm" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "contactNom" TEXT,
    "contactTelephone" TEXT,
    "contactEmail" TEXT,
    "pointDeVenteId" INTEGER,
    "remisePourcent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "conditionsParticulieres" TEXT,
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ouvertParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilRevendeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeRevendeur" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutCommandeRevendeur" NOT NULL DEFAULT 'BROUILLON',
    "revendeurId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "totalHT" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRemise" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dateLivraisonSouhaitee" TIMESTAMP(3),
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "factureId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandeRevendeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommandeRevendeur" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "montantLigne" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneCommandeRevendeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonLivraisonRevendeur" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "commandeRevendeurId" INTEGER NOT NULL,
    "livreurId" INTEGER,
    "dateDepart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonLivraisonRevendeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonLivraisonRevendeur" (
    "id" SERIAL NOT NULL,
    "bonLivraisonId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,

    CONSTRAINT "LigneBonLivraisonRevendeur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfilRevendeur_userId_key" ON "ProfilRevendeur"("userId");

-- CreateIndex
CREATE INDEX "ProfilRevendeur_statut_idx" ON "ProfilRevendeur"("statut");

-- CreateIndex
CREATE INDEX "ProfilRevendeur_pointDeVenteId_idx" ON "ProfilRevendeur"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandeRevendeur_reference_key" ON "CommandeRevendeur"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CommandeRevendeur_factureId_key" ON "CommandeRevendeur"("factureId");

-- CreateIndex
CREATE INDEX "CommandeRevendeur_statut_idx" ON "CommandeRevendeur"("statut");

-- CreateIndex
CREATE INDEX "CommandeRevendeur_revendeurId_idx" ON "CommandeRevendeur"("revendeurId");

-- CreateIndex
CREATE INDEX "CommandeRevendeur_pointDeVenteId_idx" ON "CommandeRevendeur"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "LigneCommandeRevendeur_commandeId_idx" ON "LigneCommandeRevendeur"("commandeId");

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraisonRevendeur_reference_key" ON "BonLivraisonRevendeur"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraisonRevendeur_commandeRevendeurId_key" ON "BonLivraisonRevendeur"("commandeRevendeurId");

-- CreateIndex
CREATE INDEX "LigneBonLivraisonRevendeur_bonLivraisonId_idx" ON "LigneBonLivraisonRevendeur"("bonLivraisonId");

-- CreateIndex
CREATE INDEX "FactureVente_revendeurId_idx" ON "FactureVente"("revendeurId");

-- AddForeignKey
ALTER TABLE "ProfilRevendeur" ADD CONSTRAINT "ProfilRevendeur_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilRevendeur" ADD CONSTRAINT "ProfilRevendeur_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilRevendeur" ADD CONSTRAINT "ProfilRevendeur_ouvertParId_fkey" FOREIGN KEY ("ouvertParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeRevendeur" ADD CONSTRAINT "CommandeRevendeur_revendeurId_fkey" FOREIGN KEY ("revendeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeRevendeur" ADD CONSTRAINT "CommandeRevendeur_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeRevendeur" ADD CONSTRAINT "CommandeRevendeur_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeRevendeur" ADD CONSTRAINT "CommandeRevendeur_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "FactureVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeRevendeur" ADD CONSTRAINT "LigneCommandeRevendeur_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeRevendeur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeRevendeur" ADD CONSTRAINT "LigneCommandeRevendeur_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraisonRevendeur" ADD CONSTRAINT "BonLivraisonRevendeur_commandeRevendeurId_fkey" FOREIGN KEY ("commandeRevendeurId") REFERENCES "CommandeRevendeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraisonRevendeur" ADD CONSTRAINT "BonLivraisonRevendeur_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraisonRevendeur" ADD CONSTRAINT "LigneBonLivraisonRevendeur_bonLivraisonId_fkey" FOREIGN KEY ("bonLivraisonId") REFERENCES "BonLivraisonRevendeur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraisonRevendeur" ADD CONSTRAINT "LigneBonLivraisonRevendeur_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_revendeurId_fkey" FOREIGN KEY ("revendeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
