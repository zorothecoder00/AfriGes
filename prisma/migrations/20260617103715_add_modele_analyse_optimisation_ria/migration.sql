-- CreateEnum
CREATE TYPE "TypeConstatOptimisationRIA" AS ENUM ('LENTEUR', 'DOUBLON', 'PERTE', 'SURCOUT', 'RISQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeRecommandationOptimisationRIA" AS ENUM ('VALIDATION_NUMERIQUE', 'CIRCUIT_SIMPLIFIE', 'AUTOMATISATION_CONTROLES', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutAnalyseOptimisationRIA" AS ENUM ('OUVERTE', 'EN_COURS', 'TRAITEE');

-- CreateTable
CREATE TABLE "AnalyseOptimisationRIA" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "rapportId" INTEGER,
    "constat" "TypeConstatOptimisationRIA" NOT NULL,
    "analyse" TEXT NOT NULL,
    "indicateurActuel" TEXT,
    "objectifCible" TEXT,
    "recommandation" "TypeRecommandationOptimisationRIA",
    "recommandationDetail" TEXT,
    "statut" "StatutAnalyseOptimisationRIA" NOT NULL DEFAULT 'OUVERTE',
    "analysteId" INTEGER NOT NULL,
    "resolutionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyseOptimisationRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyseOptimisationRIA_reference_key" ON "AnalyseOptimisationRIA"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyseOptimisationRIA_resolutionId_key" ON "AnalyseOptimisationRIA"("resolutionId");

-- CreateIndex
CREATE INDEX "AnalyseOptimisationRIA_statut_idx" ON "AnalyseOptimisationRIA"("statut");

-- CreateIndex
CREATE INDEX "AnalyseOptimisationRIA_rapportId_idx" ON "AnalyseOptimisationRIA"("rapportId");

-- AddForeignKey
ALTER TABLE "AnalyseOptimisationRIA" ADD CONSTRAINT "AnalyseOptimisationRIA_rapportId_fkey" FOREIGN KEY ("rapportId") REFERENCES "RapportCommissionRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyseOptimisationRIA" ADD CONSTRAINT "AnalyseOptimisationRIA_analysteId_fkey" FOREIGN KEY ("analysteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyseOptimisationRIA" ADD CONSTRAINT "AnalyseOptimisationRIA_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "ResolutionCommRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;
