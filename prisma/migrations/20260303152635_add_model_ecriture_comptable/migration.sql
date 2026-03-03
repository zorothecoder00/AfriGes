-- CreateEnum
CREATE TYPE "TypeCompte" AS ENUM ('ACTIF', 'PASSIF', 'CHARGES', 'PRODUITS', 'TRESORERIE');

-- CreateEnum
CREATE TYPE "NatureCompte" AS ENUM ('DETAIL', 'REGROUPEMENT', 'AUXILIAIRE');

-- CreateEnum
CREATE TYPE "SensCompte" AS ENUM ('DEBITEUR', 'CREDITEUR');

-- CreateEnum
CREATE TYPE "TypeJournalComptable" AS ENUM ('CAISSE', 'BANQUE', 'VENTES', 'ACHATS', 'OD', 'PAIE');

-- CreateEnum
CREATE TYPE "StatutEcriture" AS ENUM ('BROUILLON', 'VALIDE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "StatutRapprochement" AS ENUM ('EN_COURS', 'VALIDE');

-- CreateEnum
CREATE TYPE "StatutTVA" AS ENUM ('BROUILLON', 'VALIDE');

-- CreateTable
CREATE TABLE "CompteComptable" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "classe" INTEGER NOT NULL,
    "type" "TypeCompte" NOT NULL,
    "nature" "NatureCompte" NOT NULL DEFAULT 'DETAIL',
    "sens" "SensCompte" NOT NULL DEFAULT 'DEBITEUR',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "compteParentId" INTEGER,
    "tiersType" TEXT,
    "tiersNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompteComptable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcritureComptable" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "journal" "TypeJournalComptable" NOT NULL,
    "statut" "StatutEcriture" NOT NULL DEFAULT 'BROUILLON',
    "notes" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcritureComptable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneEcriture" (
    "id" SERIAL NOT NULL,
    "ecritureId" INTEGER NOT NULL,
    "compteId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isTva" BOOLEAN NOT NULL DEFAULT false,
    "tauxTva" DECIMAL(65,30),
    "montantTva" DECIMAL(65,30),

    CONSTRAINT "LigneEcriture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapprochementBancaire" (
    "id" SERIAL NOT NULL,
    "periode" TEXT NOT NULL,
    "soldeBancaireReel" DECIMAL(65,30) NOT NULL,
    "soldeComptable" DECIMAL(65,30) NOT NULL,
    "ecart" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "statut" "StatutRapprochement" NOT NULL DEFAULT 'EN_COURS',
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapprochementBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclarationTVA" (
    "id" SERIAL NOT NULL,
    "periode" TEXT NOT NULL,
    "tvaCollectee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tvaDeductible" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tvaDue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutTVA" NOT NULL DEFAULT 'BROUILLON',
    "notes" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeclarationTVA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompteComptable_numero_key" ON "CompteComptable"("numero");

-- CreateIndex
CREATE INDEX "CompteComptable_classe_idx" ON "CompteComptable"("classe");

-- CreateIndex
CREATE INDEX "CompteComptable_type_idx" ON "CompteComptable"("type");

-- CreateIndex
CREATE INDEX "CompteComptable_nature_idx" ON "CompteComptable"("nature");

-- CreateIndex
CREATE UNIQUE INDEX "EcritureComptable_reference_key" ON "EcritureComptable"("reference");

-- CreateIndex
CREATE INDEX "EcritureComptable_journal_idx" ON "EcritureComptable"("journal");

-- CreateIndex
CREATE INDEX "EcritureComptable_statut_idx" ON "EcritureComptable"("statut");

-- CreateIndex
CREATE INDEX "EcritureComptable_date_idx" ON "EcritureComptable"("date");

-- CreateIndex
CREATE INDEX "LigneEcriture_ecritureId_idx" ON "LigneEcriture"("ecritureId");

-- CreateIndex
CREATE INDEX "LigneEcriture_compteId_idx" ON "LigneEcriture"("compteId");

-- CreateIndex
CREATE INDEX "RapprochementBancaire_statut_idx" ON "RapprochementBancaire"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "RapprochementBancaire_periode_key" ON "RapprochementBancaire"("periode");

-- CreateIndex
CREATE UNIQUE INDEX "DeclarationTVA_periode_key" ON "DeclarationTVA"("periode");

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_compteParentId_fkey" FOREIGN KEY ("compteParentId") REFERENCES "CompteComptable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcritureComptable" ADD CONSTRAINT "EcritureComptable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_ecritureId_fkey" FOREIGN KEY ("ecritureId") REFERENCES "EcritureComptable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapprochementBancaire" ADD CONSTRAINT "RapprochementBancaire_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclarationTVA" ADD CONSTRAINT "DeclarationTVA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
