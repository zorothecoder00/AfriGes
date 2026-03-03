-- CreateEnum
CREATE TYPE "TypeAnomalie" AS ENUM ('MANQUANT', 'SURPLUS', 'DEFECTUEUX');

-- CreateEnum
CREATE TYPE "StatutAnomalie" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TRAITEE', 'TRANSMISE');

-- CreateEnum
CREATE TYPE "TypeBonSortie" AS ENUM ('PDV', 'PERTE', 'CASSE', 'DON', 'COMMANDE_INTERNE');

-- CreateEnum
CREATE TYPE "StatutBonSortie" AS ENUM ('EN_COURS', 'EXPEDIE', 'RECU', 'ANNULE');

-- CreateTable
CREATE TABLE "AnomalieStock" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "produitId" INTEGER NOT NULL,
    "type" "TypeAnomalie" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutAnomalie" NOT NULL DEFAULT 'EN_ATTENTE',
    "signalePar" INTEGER NOT NULL,
    "traitePar" INTEGER,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnomalieStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonSortie" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TypeBonSortie" NOT NULL,
    "statut" "StatutBonSortie" NOT NULL DEFAULT 'EN_COURS',
    "destinataire" TEXT,
    "motif" TEXT NOT NULL,
    "creePar" INTEGER NOT NULL,
    "validePar" INTEGER,
    "notes" TEXT,
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
    "prixUnit" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneBonSortie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnomalieStock_reference_key" ON "AnomalieStock"("reference");

-- CreateIndex
CREATE INDEX "AnomalieStock_produitId_idx" ON "AnomalieStock"("produitId");

-- CreateIndex
CREATE INDEX "AnomalieStock_statut_idx" ON "AnomalieStock"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "BonSortie_reference_key" ON "BonSortie"("reference");

-- CreateIndex
CREATE INDEX "BonSortie_statut_idx" ON "BonSortie"("statut");

-- CreateIndex
CREATE INDEX "BonSortie_type_idx" ON "BonSortie"("type");

-- AddForeignKey
ALTER TABLE "AnomalieStock" ADD CONSTRAINT "AnomalieStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalieStock" ADD CONSTRAINT "AnomalieStock_signalePar_fkey" FOREIGN KEY ("signalePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalieStock" ADD CONSTRAINT "AnomalieStock_traitePar_fkey" FOREIGN KEY ("traitePar") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonSortie" ADD CONSTRAINT "BonSortie_creePar_fkey" FOREIGN KEY ("creePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonSortie" ADD CONSTRAINT "BonSortie_validePar_fkey" FOREIGN KEY ("validePar") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonSortie" ADD CONSTRAINT "LigneBonSortie_bonSortieId_fkey" FOREIGN KEY ("bonSortieId") REFERENCES "BonSortie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonSortie" ADD CONSTRAINT "LigneBonSortie_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
