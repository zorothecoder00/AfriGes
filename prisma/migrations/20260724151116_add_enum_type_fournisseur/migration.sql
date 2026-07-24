/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Fournisseur` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TypeFournisseur" AS ENUM ('PRODUCTEUR', 'COOPERATIVE', 'INDUSTRIEL', 'IMPORTATEUR', 'TRANSPORTEUR');

-- AlterTable
ALTER TABLE "Fournisseur" ADD COLUMN     "banque" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "devise" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "nif" TEXT,
ADD COLUMN     "noteGlobale" DECIMAL(65,30),
ADD COLUMN     "numeroTva" TEXT,
ADD COLUMN     "pays" TEXT,
ADD COLUMN     "rccm" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "type" "TypeFournisseur";

-- CreateTable
CREATE TABLE "ContratFournisseur" (
    "id" SERIAL NOT NULL,
    "fournisseurId" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "reference" TEXT,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "fichierUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContratFournisseur_fournisseurId_idx" ON "ContratFournisseur"("fournisseurId");

-- CreateIndex
CREATE UNIQUE INDEX "Fournisseur_code_key" ON "Fournisseur"("code");

-- AddForeignKey
ALTER TABLE "ContratFournisseur" ADD CONSTRAINT "ContratFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
