/*
  Warnings:

  - A unique constraint covering the columns `[emailProfessionnel]` on the table `ProfilRH` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatutOnboarding" AS ENUM ('EN_COURS', 'TERMINE', 'SUSPENDU', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeEtapeOnboarding" AS ENUM ('SIGNATURE_CONTRAT', 'REMISE_MATERIEL', 'FORMATION', 'AFFECTATION', 'ACCES_SYSTEME', 'PRESENTATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutEtapeOnboarding" AS ENUM ('EN_ATTENTE', 'FAIT', 'IGNORE');

-- AlterTable
ALTER TABLE "ProfilRH" ADD COLUMN     "emailProfessionnel" TEXT;

-- CreateTable
CREATE TABLE "TemplateOnboarding" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapeTemplate" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeEtapeOnboarding" NOT NULL DEFAULT 'AUTRE',
    "delaiJours" INTEGER NOT NULL DEFAULT 0,
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EtapeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingEmploye" (
    "id" SERIAL NOT NULL,
    "candidatureId" INTEGER NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "statut" "StatutOnboarding" NOT NULL DEFAULT 'EN_COURS',
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFinPrevue" TIMESTAMP(3),
    "dateCloture" TIMESTAMP(3),
    "progressionPct" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingEmploye_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapeOnboarding" (
    "id" SERIAL NOT NULL,
    "onboardingId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeEtapeOnboarding" NOT NULL DEFAULT 'AUTRE',
    "statut" "StatutEtapeOnboarding" NOT NULL DEFAULT 'EN_ATTENTE',
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "responsableId" INTEGER,
    "dateLimite" TIMESTAMP(3),
    "dateFaite" TIMESTAMP(3),
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtapeOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateOnboarding_actif_idx" ON "TemplateOnboarding"("actif");

-- CreateIndex
CREATE INDEX "EtapeTemplate_templateId_idx" ON "EtapeTemplate"("templateId");

-- CreateIndex
CREATE INDEX "EtapeTemplate_templateId_ordre_idx" ON "EtapeTemplate"("templateId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingEmploye_candidatureId_key" ON "OnboardingEmploye"("candidatureId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingEmploye_profilRHId_key" ON "OnboardingEmploye"("profilRHId");

-- CreateIndex
CREATE INDEX "OnboardingEmploye_statut_idx" ON "OnboardingEmploye"("statut");

-- CreateIndex
CREATE INDEX "OnboardingEmploye_dateDebut_idx" ON "OnboardingEmploye"("dateDebut");

-- CreateIndex
CREATE INDEX "EtapeOnboarding_onboardingId_idx" ON "EtapeOnboarding"("onboardingId");

-- CreateIndex
CREATE INDEX "EtapeOnboarding_onboardingId_ordre_idx" ON "EtapeOnboarding"("onboardingId", "ordre");

-- CreateIndex
CREATE INDEX "EtapeOnboarding_statut_idx" ON "EtapeOnboarding"("statut");

-- CreateIndex
CREATE INDEX "Candidature_scoreCandidat_idx" ON "Candidature"("scoreCandidat");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilRH_emailProfessionnel_key" ON "ProfilRH"("emailProfessionnel");

-- AddForeignKey
ALTER TABLE "EtapeTemplate" ADD CONSTRAINT "EtapeTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TemplateOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingEmploye" ADD CONSTRAINT "OnboardingEmploye_candidatureId_fkey" FOREIGN KEY ("candidatureId") REFERENCES "Candidature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingEmploye" ADD CONSTRAINT "OnboardingEmploye_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingEmploye" ADD CONSTRAINT "OnboardingEmploye_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TemplateOnboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapeOnboarding" ADD CONSTRAINT "EtapeOnboarding_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "OnboardingEmploye"("id") ON DELETE CASCADE ON UPDATE CASCADE;
