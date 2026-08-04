-- CreateEnum
CREATE TYPE "StatutAvoirClient" AS ENUM ('EMIS', 'UTILISE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutLitigeClient" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'CLOTURE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "delaiPaiementJours" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AvoirClient" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" "StatutAvoirClient" NOT NULL DEFAULT 'EMIS',
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ecritureId" INTEGER,
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvoirClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LitigeClient" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "montantConteste" DECIMAL(65,30),
    "statut" "StatutLitigeClient" NOT NULL DEFAULT 'OUVERT',
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateResolution" TIMESTAMP(3),
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LitigeClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvoirClient_reference_key" ON "AvoirClient"("reference");

-- CreateIndex
CREATE INDEX "AvoirClient_clientId_idx" ON "AvoirClient"("clientId");

-- CreateIndex
CREATE INDEX "AvoirClient_statut_idx" ON "AvoirClient"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "LitigeClient_reference_key" ON "LitigeClient"("reference");

-- CreateIndex
CREATE INDEX "LitigeClient_clientId_idx" ON "LitigeClient"("clientId");

-- CreateIndex
CREATE INDEX "LitigeClient_statut_idx" ON "LitigeClient"("statut");

-- AddForeignKey
ALTER TABLE "AvoirClient" ADD CONSTRAINT "AvoirClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvoirClient" ADD CONSTRAINT "AvoirClient_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitigeClient" ADD CONSTRAINT "LitigeClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitigeClient" ADD CONSTRAINT "LitigeClient_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
