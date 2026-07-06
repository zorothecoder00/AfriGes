-- CreateEnum
CREATE TYPE "StatutCompteCourant" AS ENUM ('ACTIF', 'SUSPENDU', 'CLOTURE', 'DECEDE', 'BLACKLIST', 'FRAUDULEUX');

-- CreateEnum
CREATE TYPE "NatureMouvementCC" AS ENUM ('DEPOT', 'RETRAIT', 'PAIEMENT_CREDIT', 'PAIEMENT_COMPTANT', 'CORRECTION', 'ANNULATION', 'TRANSFERT');

-- CreateEnum
CREATE TYPE "StatutMouvementCC" AS ENUM ('VALIDE', 'EN_ATTENTE', 'ANNULE');

-- CreateTable
CREATE TABLE "ParametrageCompteCourant" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "montantMinOuverture" DECIMAL(65,30) NOT NULL DEFAULT 500,
    "soldeMinObligatoire" DECIMAL(65,30) NOT NULL DEFAULT 500,
    "depotMin" DECIMAL(65,30) NOT NULL DEFAULT 500,
    "depotMax" DECIMAL(65,30),
    "retraitMin" DECIMAL(65,30),
    "retraitMax" DECIMAL(65,30),
    "soldeMaxAutorise" DECIMAL(65,30),
    "autoriserSoldeNegatif" BOOLEAN NOT NULL DEFAULT false,
    "nbRetraitsMaxParMois" INTEGER,
    "dureeInactiviteJours" INTEGER NOT NULL DEFAULT 180,
    "codeAgence" TEXT NOT NULL DEFAULT 'TG-228',
    "codeGuichet" TEXT NOT NULL DEFAULT 'Afrs001',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametrageCompteCourant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompteCourant" (
    "id" SERIAL NOT NULL,
    "numeroCompte" TEXT NOT NULL,
    "cleRib" TEXT NOT NULL,
    "codeAgence" TEXT NOT NULL,
    "codeGuichet" TEXT NOT NULL,
    "ribComplet" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentCreateurId" INTEGER NOT NULL,
    "statut" "StatutCompteCourant" NOT NULL DEFAULT 'ACTIF',
    "motifBlocage" TEXT,
    "solde" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDepose" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRetire" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalUtilise" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "nbMouvements" INTEGER NOT NULL DEFAULT 0,
    "derniereOperationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompteCourant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementCompteCourant" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "compteId" INTEGER NOT NULL,
    "nature" "NatureMouvementCC" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "soldeAvant" DECIMAL(65,30) NOT NULL,
    "soldeApres" DECIMAL(65,30) NOT NULL,
    "modePaiement" TEXT,
    "observation" TEXT,
    "statut" "StatutMouvementCC" NOT NULL DEFAULT 'VALIDE',
    "userId" INTEGER,
    "agence" TEXT,
    "ecritureId" INTEGER,
    "venteId" INTEGER,
    "creditId" INTEGER,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementCompteCourant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompteCourant_numeroCompte_key" ON "CompteCourant"("numeroCompte");

-- CreateIndex
CREATE UNIQUE INDEX "CompteCourant_clientId_key" ON "CompteCourant"("clientId");

-- CreateIndex
CREATE INDEX "CompteCourant_statut_idx" ON "CompteCourant"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "MouvementCompteCourant_reference_key" ON "MouvementCompteCourant"("reference");

-- CreateIndex
CREATE INDEX "MouvementCompteCourant_compteId_idx" ON "MouvementCompteCourant"("compteId");

-- CreateIndex
CREATE INDEX "MouvementCompteCourant_nature_idx" ON "MouvementCompteCourant"("nature");

-- CreateIndex
CREATE INDEX "MouvementCompteCourant_createdAt_idx" ON "MouvementCompteCourant"("createdAt");

-- AddForeignKey
ALTER TABLE "CompteCourant" ADD CONSTRAINT "CompteCourant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteCourant" ADD CONSTRAINT "CompteCourant_agentCreateurId_fkey" FOREIGN KEY ("agentCreateurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementCompteCourant" ADD CONSTRAINT "MouvementCompteCourant_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteCourant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementCompteCourant" ADD CONSTRAINT "MouvementCompteCourant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
