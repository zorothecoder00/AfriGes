-- CreateEnum
CREATE TYPE "StatutEligibiliteRIA" AS ENUM ('EN_ATTENTE', 'ELIGIBLE', 'REFUSE', 'VALIDE', 'RETIRE');

-- CreateTable
CREATE TABLE "EligibiliteClientRIA" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "montantDemande" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ancienneteJours" INTEGER,
    "nbAchats" INTEGER,
    "volumeAchats" DECIMAL(65,30),
    "scoreSolvabilite" DOUBLE PRECISION,
    "niveauRisque" "NiveauRisque",
    "rotationCommerciale" DOUBLE PRECISION,
    "scoreEligibilite" DOUBLE PRECISION DEFAULT 0,
    "classeRisque" "ClasseRisqueRIA" NOT NULL DEFAULT 'A',
    "statut" "StatutEligibiliteRIA" NOT NULL DEFAULT 'EN_ATTENTE',
    "motifs" TEXT[],
    "decisionAuto" BOOLEAN NOT NULL DEFAULT true,
    "identifieParId" INTEGER,
    "dateDecision" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EligibiliteClientRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EligibiliteClientRIA_clientId_key" ON "EligibiliteClientRIA"("clientId");

-- CreateIndex
CREATE INDEX "EligibiliteClientRIA_statut_idx" ON "EligibiliteClientRIA"("statut");

-- CreateIndex
CREATE INDEX "EligibiliteClientRIA_identifieParId_idx" ON "EligibiliteClientRIA"("identifieParId");

-- AddForeignKey
ALTER TABLE "EligibiliteClientRIA" ADD CONSTRAINT "EligibiliteClientRIA_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibiliteClientRIA" ADD CONSTRAINT "EligibiliteClientRIA_identifieParId_fkey" FOREIGN KEY ("identifieParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
