-- CreateEnum
CREATE TYPE "GraviteSST" AS ENUM ('LEGER', 'GRAVE', 'MORTEL');

-- CreateEnum
CREATE TYPE "StatutAccidentTravail" AS ENUM ('DECLARE', 'EN_INSTRUCTION', 'CLOTURE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeVisiteMedicale" AS ENUM ('EMBAUCHE', 'PERIODIQUE', 'REPRISE', 'SPONTANEE');

-- CreateEnum
CREATE TYPE "ResultatAptitude" AS ENUM ('APTE', 'APTE_AVEC_RESERVES', 'INAPTE_TEMPORAIRE', 'INAPTE_DEFINITIF');

-- CreateEnum
CREATE TYPE "TypeEvenementSST" AS ENUM ('INSPECTION', 'FORMATION_SECURITE', 'PRESQUE_ACCIDENT', 'OBSERVATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeIncident" AS ENUM ('SECURITE', 'MATERIEL', 'ENVIRONNEMENT', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutIncident" AS ENUM ('OUVERT', 'EN_COURS', 'CLOTURE', 'ANNULE');

-- AlterEnum
ALTER TYPE "TypeDocumentStrategiqueRH" ADD VALUE 'PLAN_EVACUATION';

-- AlterTable
ALTER TABLE "DocumentStrategiqueRH" ADD COLUMN     "pointDeVenteId" INTEGER;

-- CreateTable
CREATE TABLE "AccidentTravail" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "dateAccident" TIMESTAMP(3) NOT NULL,
    "heureAccident" TEXT,
    "lieu" TEXT NOT NULL,
    "circonstances" TEXT NOT NULL,
    "natureLesion" TEXT,
    "gravite" "GraviteSST" NOT NULL DEFAULT 'LEGER',
    "arretTravail" BOOLEAN NOT NULL DEFAULT false,
    "dureeArretJours" INTEGER,
    "temoin" TEXT,
    "declareParId" INTEGER NOT NULL,
    "documentUrl" TEXT,
    "mesuresCorrectives" TEXT,
    "notes" TEXT,
    "statut" "StatutAccidentTravail" NOT NULL DEFAULT 'DECLARE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccidentTravail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisiteMedicale" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeVisiteMedicale" NOT NULL,
    "dateVisite" TIMESTAMP(3) NOT NULL,
    "medecin" TEXT,
    "lieu" TEXT,
    "resultatAptitude" "ResultatAptitude" NOT NULL,
    "restrictions" TEXT,
    "dateProchaineVisite" TIMESTAMP(3),
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisiteMedicale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistreSST" (
    "id" SERIAL NOT NULL,
    "type" "TypeEvenementSST" NOT NULL,
    "dateEvenement" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "lieu" TEXT,
    "responsableId" INTEGER NOT NULL,
    "actionsPrises" TEXT,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistreSST_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportIncident" (
    "id" SERIAL NOT NULL,
    "dateIncident" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT NOT NULL,
    "typeIncident" "TypeIncident" NOT NULL DEFAULT 'AUTRE',
    "description" TEXT NOT NULL,
    "personnesImpliquees" TEXT,
    "gravite" "GraviteSST" NOT NULL DEFAULT 'LEGER',
    "actionsCorrectives" TEXT,
    "declareParId" INTEGER NOT NULL,
    "documentUrl" TEXT,
    "notes" TEXT,
    "statut" "StatutIncident" NOT NULL DEFAULT 'OUVERT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapportIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccidentTravail_profilRHId_idx" ON "AccidentTravail"("profilRHId");

-- CreateIndex
CREATE INDEX "AccidentTravail_statut_idx" ON "AccidentTravail"("statut");

-- CreateIndex
CREATE INDEX "AccidentTravail_dateAccident_idx" ON "AccidentTravail"("dateAccident");

-- CreateIndex
CREATE INDEX "VisiteMedicale_profilRHId_idx" ON "VisiteMedicale"("profilRHId");

-- CreateIndex
CREATE INDEX "VisiteMedicale_dateProchaineVisite_idx" ON "VisiteMedicale"("dateProchaineVisite");

-- CreateIndex
CREATE INDEX "RegistreSST_type_idx" ON "RegistreSST"("type");

-- CreateIndex
CREATE INDEX "RegistreSST_dateEvenement_idx" ON "RegistreSST"("dateEvenement");

-- CreateIndex
CREATE INDEX "RapportIncident_statut_idx" ON "RapportIncident"("statut");

-- CreateIndex
CREATE INDEX "RapportIncident_dateIncident_idx" ON "RapportIncident"("dateIncident");

-- CreateIndex
CREATE INDEX "DocumentStrategiqueRH_pointDeVenteId_idx" ON "DocumentStrategiqueRH"("pointDeVenteId");

-- AddForeignKey
ALTER TABLE "DocumentStrategiqueRH" ADD CONSTRAINT "DocumentStrategiqueRH_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentTravail" ADD CONSTRAINT "AccidentTravail_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisiteMedicale" ADD CONSTRAINT "VisiteMedicale_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
