/*
  Warnings:

  - A unique constraint covering the columns `[codeClient]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[numeroCNI]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('MASCULIN', 'FEMININ', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('COMPTANT', 'CREDIT');

-- CreateEnum
CREATE TYPE "NiveauRisque" AS ENUM ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE');

-- AlterEnum
ALTER TYPE "MemberStatus" ADD VALUE 'BLOQUE';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "activite" TEXT,
ADD COLUMN     "codeClient" TEXT,
ADD COLUMN     "dateNaissance" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "limiteCredit" DECIMAL(65,30),
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "niveauRisque" "NiveauRisque",
ADD COLUMN     "nomCommerce" TEXT,
ADD COLUMN     "numeroCNI" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "pieceIdentiteUrl" TEXT,
ADD COLUMN     "quartier" TEXT,
ADD COLUMN     "scoreSolvabilite" DOUBLE PRECISION,
ADD COLUMN     "sexe" "Sexe",
ADD COLUMN     "soldeActuel" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "telephoneSecondaire" TEXT,
ADD COLUMN     "typeClient" "TypeClient",
ADD COLUMN     "ville" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_codeClient_key" ON "Client"("codeClient");

-- CreateIndex
CREATE UNIQUE INDEX "Client_numeroCNI_key" ON "Client"("numeroCNI");

-- CreateIndex
CREATE INDEX "Client_typeClient_idx" ON "Client"("typeClient");

-- CreateIndex
CREATE INDEX "Client_niveauRisque_idx" ON "Client"("niveauRisque");

-- CreateIndex
CREATE INDEX "Client_ville_idx" ON "Client"("ville");
