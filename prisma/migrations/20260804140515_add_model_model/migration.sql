-- CreateEnum
CREATE TYPE "StatutAvoirFournisseur" AS ENUM ('RECU', 'UTILISE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutAvanceFournisseur" AS ENUM ('VERSEE', 'IMPUTEE', 'REMBOURSEE');

-- CreateTable
CREATE TABLE "AvoirFournisseur" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "fournisseurId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" "StatutAvoirFournisseur" NOT NULL DEFAULT 'RECU',
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ecritureId" INTEGER,
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvoirFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvanceFournisseur" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "fournisseurId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "montantImpute" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutAvanceFournisseur" NOT NULL DEFAULT 'VERSEE',
    "dateVersement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modePaiement" TEXT,
    "ecritureId" INTEGER,
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvanceFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvoirFournisseur_reference_key" ON "AvoirFournisseur"("reference");

-- CreateIndex
CREATE INDEX "AvoirFournisseur_fournisseurId_idx" ON "AvoirFournisseur"("fournisseurId");

-- CreateIndex
CREATE UNIQUE INDEX "AvanceFournisseur_reference_key" ON "AvanceFournisseur"("reference");

-- CreateIndex
CREATE INDEX "AvanceFournisseur_fournisseurId_idx" ON "AvanceFournisseur"("fournisseurId");

-- AddForeignKey
ALTER TABLE "AvoirFournisseur" ADD CONSTRAINT "AvoirFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvoirFournisseur" ADD CONSTRAINT "AvoirFournisseur_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvanceFournisseur" ADD CONSTRAINT "AvanceFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvanceFournisseur" ADD CONSTRAINT "AvanceFournisseur_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
