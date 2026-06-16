-- CreateEnum
CREATE TYPE "StatutDossierInterCommission" AS ENUM ('EN_PREPARATION', 'TRANSMIS', 'RECU', 'EN_ANALYSE', 'EN_ATTENTE_DECISION', 'APPROUVE', 'REJETE', 'EXECUTE');

-- CreateEnum
CREATE TYPE "TypeDossierIC" AS ENUM ('DEMANDE_FINANCEMENT', 'RAPPORT_AUDIT', 'RECOMMANDATION', 'PLAN_ACTION', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeEchangeIC" AS ENUM ('OBSERVATION', 'DEMANDE_AJUSTEMENT', 'VALIDATION', 'REJET', 'INFORMATION', 'RETOUR_DOSSIER');

-- CreateEnum
CREATE TYPE "TypeObservationComm" AS ENUM ('COMMENTAIRE', 'PLANIFICATION', 'DOCUMENT', 'DISCUSSION', 'ALERTE');

-- CreateEnum
CREATE TYPE "TypeRapportCommRIA" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL', 'AUDIT', 'EXCEPTIONNEL');

-- CreateEnum
CREATE TYPE "StatutRapportCommRIA" AS ENUM ('BROUILLON', 'SOUMIS', 'VALIDE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "NiveauAnomalieCommRIA" AS ENUM ('MINEURE', 'MAJEURE', 'CRITIQUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleMembreCommissionRIA" ADD VALUE 'RAPPORTEUR_1';
ALTER TYPE "RoleMembreCommissionRIA" ADD VALUE 'RAPPORTEUR_2';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutPlanActionCommRIA" ADD VALUE 'NON_DEMARRE';
ALTER TYPE "StatutPlanActionCommRIA" ADD VALUE 'REALISE';
ALTER TYPE "StatutPlanActionCommRIA" ADD VALUE 'EN_RETARD';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutResolutionRIA" ADD VALUE 'EN_PREPARATION';
ALTER TYPE "StatutResolutionRIA" ADD VALUE 'SOUMISE';
ALTER TYPE "StatutResolutionRIA" ADD VALUE 'ADOPTEE';
ALTER TYPE "StatutResolutionRIA" ADD VALUE 'EXECUTEE';

-- AlterTable
ALTER TABLE "PresenceReunionRIA" ADD COLUMN     "dateSignature" TIMESTAMP(3),
ADD COLUMN     "excuse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signatureNumerique" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signatureToken" TEXT;

-- AlterTable
ALTER TABLE "ReunionCommissionRIA" ADD COLUMN     "convocationEnvoyee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dateConvocation" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CompteRenduReunionRIA" (
    "id" SERIAL NOT NULL,
    "reunionId" INTEGER NOT NULL,
    "decisions" TEXT,
    "recommandations" TEXT,
    "actionsDefinies" TEXT,
    "observations" TEXT,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompteRenduReunionRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierInterCommission" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TypeDossierIC" NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "statut" "StatutDossierInterCommission" NOT NULL DEFAULT 'EN_PREPARATION',
    "commissionEmettrice" "TypeCommissionRIA" NOT NULL,
    "commissionReceptrice" "TypeCommissionRIA" NOT NULL,
    "montantDemande" DECIMAL(65,30),
    "montantApprouve" DECIMAL(65,30),
    "versionCourante" INTEGER NOT NULL DEFAULT 1,
    "creeParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierInterCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionDossierIC" (
    "id" SERIAL NOT NULL,
    "dossierId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "contenu" JSONB NOT NULL,
    "motif" TEXT,
    "modifieParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionDossierIC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchangeInterCommission" (
    "id" SERIAL NOT NULL,
    "dossierId" INTEGER NOT NULL,
    "auteurId" INTEGER NOT NULL,
    "commission" "TypeCommissionRIA" NOT NULL,
    "type" "TypeEchangeIC" NOT NULL,
    "contenu" TEXT NOT NULL,
    "pieceJointeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EchangeInterCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationCommissionRIA" (
    "id" SERIAL NOT NULL,
    "typeCommission" "TypeCommissionRIA" NOT NULL,
    "auteurId" INTEGER NOT NULL,
    "type" "TypeObservationComm" NOT NULL,
    "contenu" TEXT NOT NULL,
    "pieceJointeUrl" TEXT,
    "epingle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationCommissionRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportCommissionRIA" (
    "id" SERIAL NOT NULL,
    "typeCommission" "TypeCommissionRIA" NOT NULL,
    "type" "TypeRapportCommRIA" NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" JSONB,
    "contenuHtml" TEXT,
    "statut" "StatutRapportCommRIA" NOT NULL DEFAULT 'BROUILLON',
    "periode" TEXT,
    "redacteurId" INTEGER,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapportCommissionRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalieGouvRIA" (
    "id" SERIAL NOT NULL,
    "typeCommission" "TypeCommissionRIA",
    "niveau" "NiveauAnomalieCommRIA" NOT NULL DEFAULT 'MINEURE',
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "donnees" JSONB,
    "resolue" BOOLEAN NOT NULL DEFAULT false,
    "dateResolution" TIMESTAMP(3),
    "resolueParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnomalieGouvRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompteRenduReunionRIA_reunionId_key" ON "CompteRenduReunionRIA"("reunionId");

-- CreateIndex
CREATE UNIQUE INDEX "DossierInterCommission_reference_key" ON "DossierInterCommission"("reference");

-- CreateIndex
CREATE INDEX "DossierInterCommission_statut_idx" ON "DossierInterCommission"("statut");

-- CreateIndex
CREATE INDEX "DossierInterCommission_commissionEmettrice_idx" ON "DossierInterCommission"("commissionEmettrice");

-- CreateIndex
CREATE INDEX "DossierInterCommission_commissionReceptrice_idx" ON "DossierInterCommission"("commissionReceptrice");

-- CreateIndex
CREATE INDEX "DossierInterCommission_type_idx" ON "DossierInterCommission"("type");

-- CreateIndex
CREATE INDEX "VersionDossierIC_dossierId_idx" ON "VersionDossierIC"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "VersionDossierIC_dossierId_version_key" ON "VersionDossierIC"("dossierId", "version");

-- CreateIndex
CREATE INDEX "EchangeInterCommission_dossierId_idx" ON "EchangeInterCommission"("dossierId");

-- CreateIndex
CREATE INDEX "EchangeInterCommission_auteurId_idx" ON "EchangeInterCommission"("auteurId");

-- CreateIndex
CREATE INDEX "EchangeInterCommission_commission_idx" ON "EchangeInterCommission"("commission");

-- CreateIndex
CREATE INDEX "ObservationCommissionRIA_typeCommission_idx" ON "ObservationCommissionRIA"("typeCommission");

-- CreateIndex
CREATE INDEX "ObservationCommissionRIA_auteurId_idx" ON "ObservationCommissionRIA"("auteurId");

-- CreateIndex
CREATE INDEX "ObservationCommissionRIA_typeCommission_epingle_idx" ON "ObservationCommissionRIA"("typeCommission", "epingle");

-- CreateIndex
CREATE INDEX "RapportCommissionRIA_typeCommission_idx" ON "RapportCommissionRIA"("typeCommission");

-- CreateIndex
CREATE INDEX "RapportCommissionRIA_type_idx" ON "RapportCommissionRIA"("type");

-- CreateIndex
CREATE INDEX "RapportCommissionRIA_statut_idx" ON "RapportCommissionRIA"("statut");

-- CreateIndex
CREATE INDEX "RapportCommissionRIA_periode_idx" ON "RapportCommissionRIA"("periode");

-- CreateIndex
CREATE INDEX "AnomalieGouvRIA_typeCommission_idx" ON "AnomalieGouvRIA"("typeCommission");

-- CreateIndex
CREATE INDEX "AnomalieGouvRIA_niveau_idx" ON "AnomalieGouvRIA"("niveau");

-- CreateIndex
CREATE INDEX "AnomalieGouvRIA_resolue_idx" ON "AnomalieGouvRIA"("resolue");

-- CreateIndex
CREATE INDEX "AnomalieGouvRIA_createdAt_idx" ON "AnomalieGouvRIA"("createdAt");

-- AddForeignKey
ALTER TABLE "CompteRenduReunionRIA" ADD CONSTRAINT "CompteRenduReunionRIA_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionCommissionRIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteRenduReunionRIA" ADD CONSTRAINT "CompteRenduReunionRIA_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierInterCommission" ADD CONSTRAINT "DossierInterCommission_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierInterCommission" ADD CONSTRAINT "DossierInterCommission_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionDossierIC" ADD CONSTRAINT "VersionDossierIC_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "DossierInterCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionDossierIC" ADD CONSTRAINT "VersionDossierIC_modifieParId_fkey" FOREIGN KEY ("modifieParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchangeInterCommission" ADD CONSTRAINT "EchangeInterCommission_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "DossierInterCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchangeInterCommission" ADD CONSTRAINT "EchangeInterCommission_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationCommissionRIA" ADD CONSTRAINT "ObservationCommissionRIA_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportCommissionRIA" ADD CONSTRAINT "RapportCommissionRIA_redacteurId_fkey" FOREIGN KEY ("redacteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportCommissionRIA" ADD CONSTRAINT "RapportCommissionRIA_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalieGouvRIA" ADD CONSTRAINT "AnomalieGouvRIA_resolueParId_fkey" FOREIGN KEY ("resolueParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
