-- CreateEnum
CREATE TYPE "StatutCommissionRIA" AS ENUM ('CALCULE', 'APPROUVE', 'PAYE', 'ANNULE');

-- CreateTable
CREATE TABLE "ConfigCommissionRIA" (
    "id" SERIAL NOT NULL,
    "roleType" TEXT NOT NULL,
    "tauxBase" DECIMAL(65,30) NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigCommissionRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionAgentRIA" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "roleType" TEXT NOT NULL,
    "pdvId" INTEGER,
    "montantRecouvre" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "nbDossiers" INTEGER NOT NULL DEFAULT 0,
    "nbDossiersRembourses" INTEGER NOT NULL DEFAULT 0,
    "tauxSucces" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taux" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montant" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutCommissionRIA" NOT NULL DEFAULT 'CALCULE',
    "approuveParId" INTEGER,
    "dateApprobation" TIMESTAMP(3),
    "datePaiement" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionAgentRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigCommissionRIA_roleType_key" ON "ConfigCommissionRIA"("roleType");

-- CreateIndex
CREATE INDEX "CommissionAgentRIA_mois_annee_idx" ON "CommissionAgentRIA"("mois", "annee");

-- CreateIndex
CREATE INDEX "CommissionAgentRIA_statut_idx" ON "CommissionAgentRIA"("statut");

-- CreateIndex
CREATE INDEX "CommissionAgentRIA_userId_idx" ON "CommissionAgentRIA"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionAgentRIA_userId_mois_annee_roleType_key" ON "CommissionAgentRIA"("userId", "mois", "annee", "roleType");

-- AddForeignKey
ALTER TABLE "CommissionAgentRIA" ADD CONSTRAINT "CommissionAgentRIA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAgentRIA" ADD CONSTRAINT "CommissionAgentRIA_approuveParId_fkey" FOREIGN KEY ("approuveParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
