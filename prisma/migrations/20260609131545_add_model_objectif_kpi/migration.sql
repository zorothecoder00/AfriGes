-- CreateEnum
CREATE TYPE "TypeEvaluation" AS ENUM ('HIERARCHIQUE', 'AUTO_EVALUATION', 'EVALUATION_360');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutEvaluationRH" ADD VALUE 'OBJECTIFS_FIXES';
ALTER TYPE "StatutEvaluationRH" ADD VALUE 'EVALUATION';
ALTER TYPE "StatutEvaluationRH" ADD VALUE 'VALIDATION';
ALTER TYPE "StatutEvaluationRH" ADD VALUE 'PLAN_AMELIORATION';

-- AlterTable
ALTER TABLE "EvaluationRH" ADD COLUMN     "planAmelioration" TEXT,
ADD COLUMN     "typeEvaluation" "TypeEvaluation";

-- CreateTable
CREATE TABLE "ObjectifKPI" (
    "id" SERIAL NOT NULL,
    "evaluationId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "indicateur" TEXT,
    "valeurCible" DECIMAL(65,30) NOT NULL,
    "valeurAtteinte" DECIMAL(65,30),
    "unite" TEXT,
    "poids" INTEGER,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectifKPI_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObjectifKPI_evaluationId_idx" ON "ObjectifKPI"("evaluationId");

-- AddForeignKey
ALTER TABLE "ObjectifKPI" ADD CONSTRAINT "ObjectifKPI_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "EvaluationRH"("id") ON DELETE CASCADE ON UPDATE CASCADE;
