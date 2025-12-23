-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIF', 'INACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOT', 'RETRAIT', 'COTISATION', 'TONTINE', 'REMBOURSEMENT_CREDIT', 'ACHAT', 'ANNULATION');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AGENT', 'SUPERVISEUR', 'CAISSIER');

-- CreateEnum
CREATE TYPE "Frequence" AS ENUM ('JOURNALIER', 'HEBDOMADAIRE', 'MENSUEL');

-- CreateEnum
CREATE TYPE "StatutTontine" AS ENUM ('ACTIVE', 'TERMINEE', 'SUSPENDUE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('WALLET', 'CASH', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "StatutCredit" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE', 'REMBOURSE_PARTIEL', 'REMBOURSE_TOTAL');

-- CreateEnum
CREATE TYPE "TransactionCreditType" AS ENUM ('DECAISSEMENT', 'REMBOURSEMENT');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT');

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "passwordHash" TEXT NOT NULL,
    "etat" "MemberStatus" NOT NULL DEFAULT 'ACTIF',
    "dateAdhesion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "soldeGeneral" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "soldeTontine" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "soldeCredit" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gestionnaire" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tontine" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "montantCotisation" DECIMAL(65,30) NOT NULL,
    "frequence" "Frequence" NOT NULL,
    "statut" "StatutTontine" NOT NULL DEFAULT 'ACTIVE',
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tontine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TontineMembre" (
    "id" SERIAL NOT NULL,
    "tontineId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "ordreTirage" INTEGER,
    "dateEntree" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateSortie" TIMESTAMP(3),

    CONSTRAINT "TontineMembre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotisation" (
    "id" SERIAL NOT NULL,
    "tontineMembreId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "reference" TEXT NOT NULL,
    "modePaiement" "ModePaiement" NOT NULL,
    "dateCotisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cotisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "montantRestant" DECIMAL(65,30) NOT NULL,
    "dateDemande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutCredit" NOT NULL DEFAULT 'EN_ATTENTE',
    "scoreRisque" DECIMAL(65,30),

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TransactionCreditType" NOT NULL,
    "dateTransaction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "alerteStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementStock" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "motif" TEXT,
    "reference" TEXT NOT NULL,
    "dateMouvement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_uuid_key" ON "Member"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_memberId_key" ON "Wallet"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Gestionnaire_memberId_key" ON "Gestionnaire"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Cotisation_reference_key" ON "Cotisation"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "MouvementStock_reference_key" ON "MouvementStock"("reference");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gestionnaire" ADD CONSTRAINT "Gestionnaire_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineMembre" ADD CONSTRAINT "TontineMembre_tontineId_fkey" FOREIGN KEY ("tontineId") REFERENCES "Tontine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineMembre" ADD CONSTRAINT "TontineMembre_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_tontineMembreId_fkey" FOREIGN KEY ("tontineMembreId") REFERENCES "TontineMembre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
