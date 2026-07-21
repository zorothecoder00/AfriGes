-- CreateEnum
CREATE TYPE "FormuleCredit" AS ENUM ('QUINZAINE', 'TRENTAINE');

-- CreateEnum
CREATE TYPE "StatutParametragePOPC" AS ENUM ('BROUILLON', 'VALIDE');

-- AlterTable
ALTER TABLE "CreditClient" ADD COLUMN     "formule" "FormuleCredit";

-- CreateTable
CREATE TABLE "ParametragePOPC" (
    "id" SERIAL NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "statut" "StatutParametragePOPC" NOT NULL DEFAULT 'BROUILLON',
    "salaireAgents" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "salaireSuperviseurs" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "salaireControleurs" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "salaireResponsables" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "carburant" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "entretienMotos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "telephone" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "internet" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "loyer" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eau" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "electricite" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fournitures" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "publicite" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "divers" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "objectifBenefice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "commissionSeizieme" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "commissionTrentaine" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "prixCarnet" DECIMAL(65,30) NOT NULL DEFAULT 300,
    "joursOuvrables" INTEGER NOT NULL DEFAULT 26,
    "nombreAgentsTerrain" INTEGER NOT NULL DEFAULT 1,
    "nombreAgences" INTEGER NOT NULL DEFAULT 1,
    "partRevenu16" DECIMAL(65,30) NOT NULL DEFAULT 50,
    "partRevenu31" DECIMAL(65,30) NOT NULL DEFAULT 40,
    "partRevenuCarnet" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "creditsParClient" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "creeParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametragePOPC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectifPOPC" (
    "id" SERIAL NOT NULL,
    "parametrageId" INTEGER NOT NULL,
    "chargesTotales" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "objectifBenefice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "revenuMinimum" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "nbSeiziemes" INTEGER NOT NULL DEFAULT 0,
    "nbTrentiemes" INTEGER NOT NULL DEFAULT 0,
    "nbCarnets" INTEGER NOT NULL DEFAULT 0,
    "nbNouveauxCredits" INTEGER NOT NULL DEFAULT 0,
    "nbClientsRecruter" INTEGER NOT NULL DEFAULT 0,
    "objectifQuotidien" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "objectifHebdomadaire" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "objectifMensuel" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectifPOPC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenteCarnet" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL DEFAULT 300,
    "agentId" INTEGER,
    "pointDeVenteId" INTEGER,
    "clientId" INTEGER,
    "dateVente" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enregistreParId" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenteCarnet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParametragePOPC_annee_mois_idx" ON "ParametragePOPC"("annee", "mois");

-- CreateIndex
CREATE INDEX "ParametragePOPC_pointDeVenteId_idx" ON "ParametragePOPC"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametragePOPC_annee_mois_pointDeVenteId_key" ON "ParametragePOPC"("annee", "mois", "pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectifPOPC_parametrageId_key" ON "ObjectifPOPC"("parametrageId");

-- CreateIndex
CREATE UNIQUE INDEX "VenteCarnet_reference_key" ON "VenteCarnet"("reference");

-- CreateIndex
CREATE INDEX "VenteCarnet_agentId_idx" ON "VenteCarnet"("agentId");

-- CreateIndex
CREATE INDEX "VenteCarnet_pointDeVenteId_idx" ON "VenteCarnet"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "VenteCarnet_dateVente_idx" ON "VenteCarnet"("dateVente");

-- AddForeignKey
ALTER TABLE "ObjectifPOPC" ADD CONSTRAINT "ObjectifPOPC_parametrageId_fkey" FOREIGN KEY ("parametrageId") REFERENCES "ParametragePOPC"("id") ON DELETE CASCADE ON UPDATE CASCADE;
