-- CreateEnum
CREATE TYPE "StatutCycle" AS ENUM ('EN_COURS', 'COMPLETE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutContribution" AS ENUM ('EN_ATTENTE', 'PAYEE');

-- CreateTable
CREATE TABLE "TontineCycle" (
    "id" SERIAL NOT NULL,
    "tontineId" INTEGER NOT NULL,
    "numeroCycle" INTEGER NOT NULL,
    "beneficiaireId" INTEGER NOT NULL,
    "montantPot" DECIMAL(65,30) NOT NULL,
    "statut" "StatutCycle" NOT NULL DEFAULT 'EN_COURS',
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCloture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TontineCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TontineContribution" (
    "id" SERIAL NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "membreId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "statut" "StatutContribution" NOT NULL DEFAULT 'EN_ATTENTE',
    "datePaiement" TIMESTAMP(3),
    "notePaiement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TontineContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TontineCycle_tontineId_numeroCycle_key" ON "TontineCycle"("tontineId", "numeroCycle");

-- CreateIndex
CREATE UNIQUE INDEX "TontineContribution_cycleId_membreId_key" ON "TontineContribution"("cycleId", "membreId");

-- AddForeignKey
ALTER TABLE "TontineCycle" ADD CONSTRAINT "TontineCycle_tontineId_fkey" FOREIGN KEY ("tontineId") REFERENCES "Tontine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineCycle" ADD CONSTRAINT "TontineCycle_beneficiaireId_fkey" FOREIGN KEY ("beneficiaireId") REFERENCES "TontineMembre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineContribution" ADD CONSTRAINT "TontineContribution_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TontineCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineContribution" ADD CONSTRAINT "TontineContribution_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "TontineMembre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
