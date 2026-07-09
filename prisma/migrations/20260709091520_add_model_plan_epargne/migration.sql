-- CreateEnum
CREATE TYPE "FrequenceEpargne" AS ENUM ('QUOTIDIENNE', 'HEBDOMADAIRE', 'MENSUELLE');

-- CreateEnum
CREATE TYPE "StatutPlanEpargne" AS ENUM ('EN_COURS', 'ATTEINT', 'ABANDONNE', 'EXPIRE');

-- AlterTable
ALTER TABLE "MouvementCompteCourant" ADD COLUMN     "planEpargneId" INTEGER;

-- CreateTable
CREATE TABLE "PlanEpargne" (
    "id" SERIAL NOT NULL,
    "compteId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "objectifMontant" DECIMAL(65,30) NOT NULL,
    "frequence" "FrequenceEpargne" NOT NULL,
    "montantCotisation" DECIMAL(65,30) NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "montantCumule" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutPlanEpargne" NOT NULL DEFAULT 'EN_COURS',
    "dateAtteint" TIMESTAMP(3),
    "observation" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEpargne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanEpargne_compteId_idx" ON "PlanEpargne"("compteId");

-- CreateIndex
CREATE INDEX "PlanEpargne_statut_idx" ON "PlanEpargne"("statut");

-- AddForeignKey
ALTER TABLE "PlanEpargne" ADD CONSTRAINT "PlanEpargne_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteCourant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEpargne" ADD CONSTRAINT "PlanEpargne_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementCompteCourant" ADD CONSTRAINT "MouvementCompteCourant_planEpargneId_fkey" FOREIGN KEY ("planEpargneId") REFERENCES "PlanEpargne"("id") ON DELETE SET NULL ON UPDATE CASCADE;
