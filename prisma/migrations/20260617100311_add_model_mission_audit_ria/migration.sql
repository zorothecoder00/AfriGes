-- CreateEnum
CREATE TYPE "StatutMissionAuditRIA" AS ENUM ('OUVERTE', 'EN_COURS', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "ResultatMissionAuditRIA" AS ENUM ('CONFORME', 'NON_CONFORME');

-- CreateEnum
CREATE TYPE "NiveauRisqueMissionAuditRIA" AS ENUM ('RISQUE_MINEUR', 'RISQUE_MAJEUR', 'FRAUDE_SUSPECTEE');

-- CreateTable
CREATE TABLE "MissionAuditRIA" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "financementId" INTEGER,
    "dossierICId" INTEGER,
    "statut" "StatutMissionAuditRIA" NOT NULL DEFAULT 'OUVERTE',
    "checklist" JSONB NOT NULL,
    "resultat" "ResultatMissionAuditRIA",
    "niveauRisque" "NiveauRisqueMissionAuditRIA",
    "conclusion" TEXT,
    "auditeurId" INTEGER NOT NULL,
    "dateCloture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionAuditRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionAuditRIA_reference_key" ON "MissionAuditRIA"("reference");

-- CreateIndex
CREATE INDEX "MissionAuditRIA_statut_idx" ON "MissionAuditRIA"("statut");

-- CreateIndex
CREATE INDEX "MissionAuditRIA_financementId_idx" ON "MissionAuditRIA"("financementId");

-- CreateIndex
CREATE INDEX "MissionAuditRIA_dossierICId_idx" ON "MissionAuditRIA"("dossierICId");

-- AddForeignKey
ALTER TABLE "MissionAuditRIA" ADD CONSTRAINT "MissionAuditRIA_financementId_fkey" FOREIGN KEY ("financementId") REFERENCES "OperationFinancementRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAuditRIA" ADD CONSTRAINT "MissionAuditRIA_dossierICId_fkey" FOREIGN KEY ("dossierICId") REFERENCES "DossierInterCommission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionAuditRIA" ADD CONSTRAINT "MissionAuditRIA_auditeurId_fkey" FOREIGN KEY ("auditeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
