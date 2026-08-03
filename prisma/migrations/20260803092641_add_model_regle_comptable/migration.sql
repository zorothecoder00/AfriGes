-- CreateEnum
CREATE TYPE "ModeRegleComptable" AS ENUM ('AUTOMATIQUE', 'MANUEL');

-- AlterEnum
ALTER TYPE "StatutEcriture" ADD VALUE 'A_CONTROLER';

-- CreateTable
CREATE TABLE "RegleComptable" (
    "id" SERIAL NOT NULL,
    "evenement" TEXT NOT NULL,
    "moduleSource" TEXT NOT NULL,
    "conditionProduit" TEXT,
    "conditionFamille" TEXT,
    "conditionModePaiement" TEXT,
    "compteDebitNumero" TEXT NOT NULL,
    "compteCreditNumero" TEXT NOT NULL,
    "journal" "TypeJournalComptable" NOT NULL,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "mode" "ModeRegleComptable" NOT NULL DEFAULT 'AUTOMATIQUE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegleComptable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegleComptable_evenement_idx" ON "RegleComptable"("evenement");

-- CreateIndex
CREATE INDEX "RegleComptable_actif_idx" ON "RegleComptable"("actif");
