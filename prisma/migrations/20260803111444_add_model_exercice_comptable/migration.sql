-- CreateEnum
CREATE TYPE "RegimeFiscal" AS ENUM ('REEL_NORMAL', 'REEL_SIMPLIFIE', 'EXONERE');

-- CreateEnum
CREATE TYPE "FrequenceRecurrente" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "StatutRecurrente" AS ENUM ('ACTIF', 'SUSPENDU', 'TERMINE');

-- CreateEnum
CREATE TYPE "StatutExercice" AS ENUM ('PREPARATION', 'OUVERT', 'EN_CLOTURE', 'CLOTURE', 'ARCHIVE');

-- CreateTable
CREATE TABLE "TaxeConfig" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "taux" DECIMAL(65,30) NOT NULL,
    "nature" TEXT NOT NULL,
    "compteCollecteNumero" TEXT NOT NULL,
    "compteDeductibleNumero" TEXT,
    "compteRegularisationNumero" TEXT,
    "regimeFiscal" "RegimeFiscal" NOT NULL DEFAULT 'REEL_NORMAL',
    "applicableAchat" BOOLEAN NOT NULL DEFAULT true,
    "applicableVente" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcritureRecurrente" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "compteDebitNumero" TEXT NOT NULL,
    "compteCreditNumero" TEXT NOT NULL,
    "journal" "TypeJournalComptable" NOT NULL,
    "frequence" "FrequenceRecurrente" NOT NULL DEFAULT 'MENSUEL',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "nombreOccurrencesMax" INTEGER,
    "nombreOccurrencesGenerees" INTEGER NOT NULL DEFAULT 0,
    "derniereGenerationLe" TIMESTAMP(3),
    "statut" "StatutRecurrente" NOT NULL DEFAULT 'ACTIF',
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcritureRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciceComptable" (
    "id" SERIAL NOT NULL,
    "annee" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "statut" "StatutExercice" NOT NULL DEFAULT 'PREPARATION',
    "clotureParId" INTEGER,
    "dateCloture" TIMESTAMP(3),
    "ecritureClotureId" INTEGER,
    "ecritureReportANouveauId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciceComptable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxeConfig_code_key" ON "TaxeConfig"("code");

-- CreateIndex
CREATE INDEX "EcritureRecurrente_statut_idx" ON "EcritureRecurrente"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciceComptable_annee_key" ON "ExerciceComptable"("annee");

-- AddForeignKey
ALTER TABLE "EcritureRecurrente" ADD CONSTRAINT "EcritureRecurrente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciceComptable" ADD CONSTRAINT "ExerciceComptable_clotureParId_fkey" FOREIGN KEY ("clotureParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
