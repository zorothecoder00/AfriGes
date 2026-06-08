-- CreateEnum
CREATE TYPE "PeriodeEvaluation" AS ENUM ('ANNUELLE', 'SEMESTRIELLE', 'TRIMESTRIELLE', 'PROBATOIRE');

-- CreateEnum
CREATE TYPE "StatutEvaluationRH" AS ENUM ('BROUILLON', 'EN_COURS', 'CLOTURE');

-- CreateEnum
CREATE TYPE "StatutPoste" AS ENUM ('OUVERT', 'EN_COURS', 'POURVU', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutCandidature" AS ENUM ('RECU', 'SHORTLISTE', 'ENTRETIEN', 'OFFRE', 'ACCEPTE', 'REJETE');

-- CreateEnum
CREATE TYPE "TypeSanction" AS ENUM ('AVERTISSEMENT', 'BLAME', 'MISE_A_PIED', 'LICENCIEMENT_CAUSE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutProcedure" AS ENUM ('OUVERTE', 'EN_INSTRUCTION', 'CLOTUREE', 'ANNULEE');

-- CreateTable
CREATE TABLE "EvaluationRH" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "evaluateurId" INTEGER,
    "periode" "PeriodeEvaluation" NOT NULL,
    "annee" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "statut" "StatutEvaluationRH" NOT NULL DEFAULT 'BROUILLON',
    "noteGlobale" DECIMAL(65,30),
    "appreciation" TEXT,
    "pointsForts" TEXT,
    "axesAmelioration" TEXT,
    "objectifsN1" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationRH_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CritereEvaluation" (
    "id" SERIAL NOT NULL,
    "evaluationId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "note" DECIMAL(65,30) NOT NULL,
    "commentaire" TEXT,

    CONSTRAINT "CritereEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteOuvert" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "departement" TEXT,
    "service" TEXT,
    "typeContrat" "TypeContrat",
    "description" TEXT,
    "competencesRequises" TEXT,
    "experienceMin" INTEGER,
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLimite" TIMESTAMP(3),
    "statut" "StatutPoste" NOT NULL DEFAULT 'OUVERT',
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosteOuvert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidature" (
    "id" SERIAL NOT NULL,
    "posteId" INTEGER NOT NULL,
    "nomCandidat" TEXT NOT NULL,
    "prenomCandidat" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "cvUrl" TEXT,
    "lettreUrl" TEXT,
    "statut" "StatutCandidature" NOT NULL DEFAULT 'RECU',
    "noteEntretien" DECIMAL(65,30),
    "dateEntretien" TIMESTAMP(3),
    "commentaire" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureDisciplinaire" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeSanction" NOT NULL,
    "motif" TEXT NOT NULL,
    "faitsReproches" TEXT,
    "dateIncident" TIMESTAMP(3) NOT NULL,
    "dateProcedure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutProcedure" NOT NULL DEFAULT 'OUVERTE',
    "dateConvocation" TIMESTAMP(3),
    "reponseCollab" TEXT,
    "decision" TEXT,
    "dateDecision" TIMESTAMP(3),
    "dureeSuspension" INTEGER,
    "notes" TEXT,
    "traiteParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureDisciplinaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationRH_profilRHId_idx" ON "EvaluationRH"("profilRHId");

-- CreateIndex
CREATE INDEX "EvaluationRH_annee_idx" ON "EvaluationRH"("annee");

-- CreateIndex
CREATE INDEX "EvaluationRH_statut_idx" ON "EvaluationRH"("statut");

-- CreateIndex
CREATE INDEX "CritereEvaluation_evaluationId_idx" ON "CritereEvaluation"("evaluationId");

-- CreateIndex
CREATE INDEX "PosteOuvert_statut_idx" ON "PosteOuvert"("statut");

-- CreateIndex
CREATE INDEX "Candidature_posteId_idx" ON "Candidature"("posteId");

-- CreateIndex
CREATE INDEX "Candidature_statut_idx" ON "Candidature"("statut");

-- CreateIndex
CREATE INDEX "ProcedureDisciplinaire_profilRHId_idx" ON "ProcedureDisciplinaire"("profilRHId");

-- CreateIndex
CREATE INDEX "ProcedureDisciplinaire_statut_idx" ON "ProcedureDisciplinaire"("statut");

-- AddForeignKey
ALTER TABLE "EvaluationRH" ADD CONSTRAINT "EvaluationRH_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRH" ADD CONSTRAINT "EvaluationRH_evaluateurId_fkey" FOREIGN KEY ("evaluateurId") REFERENCES "ProfilRH"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CritereEvaluation" ADD CONSTRAINT "CritereEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationRH"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "PosteOuvert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureDisciplinaire" ADD CONSTRAINT "ProcedureDisciplinaire_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
