-- CreateEnum
CREATE TYPE "StatutDemandeRH" AS ENUM ('EN_ATTENTE', 'VALIDE_MANAGER', 'VALIDE_RH', 'APPROUVE', 'REJETE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutPlanningEquipe" AS ENUM ('BROUILLON', 'PUBLIE');

-- CreateEnum
CREATE TYPE "StatutActionDeveloppement" AS ENUM ('A_FAIRE', 'EN_COURS', 'REALISE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutPlanAnnuel" AS ENUM ('BROUILLON', 'VALIDE', 'CLOTURE');

-- AlterTable
ALTER TABLE "Formation" ADD COLUMN     "planFormationId" INTEGER;

-- AlterTable
ALTER TABLE "PosteOuvert" ADD COLUMN     "planRecrutementId" INTEGER;

-- CreateTable
CREATE TABLE "DemandeMouvementCarriere" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeMouvementCarriere" NOT NULL,
    "nouvelleFonction" TEXT,
    "nouveauService" TEXT,
    "nouveauDepartement" TEXT,
    "nouveauSalaire" DECIMAL(65,30),
    "nouveauManagerId" INTEGER,
    "motif" TEXT,
    "demandeParId" INTEGER NOT NULL,
    "statut" "StatutDemandeRH" NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaireRefus" TEXT,
    "dateValidationRH" TIMESTAMP(3),
    "dateDecisionFinale" TIMESTAMP(3),
    "historiquePosteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeMouvementCarriere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFormationAnnuel" (
    "id" SERIAL NOT NULL,
    "annee" INTEGER NOT NULL,
    "budgetTotal" DECIMAL(65,30),
    "axesPrioritaires" TEXT,
    "notes" TEXT,
    "statut" "StatutPlanAnnuel" NOT NULL DEFAULT 'BROUILLON',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanFormationAnnuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeFormation" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "intituleSouhaite" TEXT NOT NULL,
    "formationId" INTEGER,
    "motif" TEXT,
    "statut" "StatutDemandeRH" NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaireRefus" TEXT,
    "dateValidationMgr" TIMESTAMP(3),
    "dateValidationRH" TIMESTAMP(3),
    "dateDecisionFinale" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeFormation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningEquipe" (
    "id" SERIAL NOT NULL,
    "semaineDebut" TIMESTAMP(3) NOT NULL,
    "statut" "StatutPlanningEquipe" NOT NULL DEFAULT 'BROUILLON',
    "responsableId" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningEquipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffectationPlanning" (
    "id" SERIAL NOT NULL,
    "planningId" INTEGER NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "role" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffectationPlanning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionDeveloppement" (
    "id" SERIAL NOT NULL,
    "evaluationId" INTEGER NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "objectif" TEXT NOT NULL,
    "actionPrevue" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" "StatutActionDeveloppement" NOT NULL DEFAULT 'A_FAIRE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionDeveloppement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanRecrutementAnnuel" (
    "id" SERIAL NOT NULL,
    "annee" INTEGER NOT NULL,
    "budgetTotal" DECIMAL(65,30),
    "effectifCible" INTEGER,
    "notes" TEXT,
    "statut" "StatutPlanAnnuel" NOT NULL DEFAULT 'BROUILLON',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanRecrutementAnnuel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeMouvementCarriere_profilRHId_idx" ON "DemandeMouvementCarriere"("profilRHId");

-- CreateIndex
CREATE INDEX "DemandeMouvementCarriere_statut_idx" ON "DemandeMouvementCarriere"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFormationAnnuel_annee_key" ON "PlanFormationAnnuel"("annee");

-- CreateIndex
CREATE INDEX "DemandeFormation_profilRHId_idx" ON "DemandeFormation"("profilRHId");

-- CreateIndex
CREATE INDEX "DemandeFormation_statut_idx" ON "DemandeFormation"("statut");

-- CreateIndex
CREATE INDEX "PlanningEquipe_semaineDebut_idx" ON "PlanningEquipe"("semaineDebut");

-- CreateIndex
CREATE INDEX "PlanningEquipe_statut_idx" ON "PlanningEquipe"("statut");

-- CreateIndex
CREATE INDEX "AffectationPlanning_planningId_idx" ON "AffectationPlanning"("planningId");

-- CreateIndex
CREATE INDEX "AffectationPlanning_profilRHId_idx" ON "AffectationPlanning"("profilRHId");

-- CreateIndex
CREATE INDEX "AffectationPlanning_date_idx" ON "AffectationPlanning"("date");

-- CreateIndex
CREATE INDEX "ActionDeveloppement_evaluationId_idx" ON "ActionDeveloppement"("evaluationId");

-- CreateIndex
CREATE INDEX "ActionDeveloppement_profilRHId_idx" ON "ActionDeveloppement"("profilRHId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanRecrutementAnnuel_annee_key" ON "PlanRecrutementAnnuel"("annee");

-- CreateIndex
CREATE INDEX "Formation_planFormationId_idx" ON "Formation"("planFormationId");

-- CreateIndex
CREATE INDEX "PosteOuvert_planRecrutementId_idx" ON "PosteOuvert"("planRecrutementId");

-- AddForeignKey
ALTER TABLE "DemandeMouvementCarriere" ADD CONSTRAINT "DemandeMouvementCarriere_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_planFormationId_fkey" FOREIGN KEY ("planFormationId") REFERENCES "PlanFormationAnnuel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeFormation" ADD CONSTRAINT "DemandeFormation_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeFormation" ADD CONSTRAINT "DemandeFormation_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationPlanning" ADD CONSTRAINT "AffectationPlanning_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "PlanningEquipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationPlanning" ADD CONSTRAINT "AffectationPlanning_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionDeveloppement" ADD CONSTRAINT "ActionDeveloppement_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationRH"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteOuvert" ADD CONSTRAINT "PosteOuvert_planRecrutementId_fkey" FOREIGN KEY ("planRecrutementId") REFERENCES "PlanRecrutementAnnuel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
