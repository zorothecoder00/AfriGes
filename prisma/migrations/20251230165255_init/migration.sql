-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIF', 'INACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOT', 'RETRAIT', 'COTISATION', 'TONTINE', 'REMBOURSEMENT_CREDIT', 'CREDIT', 'ACHAT', 'ANNULATION');

-- CreateEnum
CREATE TYPE "RoleGestionnaire" AS ENUM ('AGENT', 'SUPERVISEUR', 'CAISSIER');

-- CreateEnum
CREATE TYPE "PeriodeCotisation" AS ENUM ('MENSUEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "StatutCotisation" AS ENUM ('EN_ATTENTE', 'PAYEE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "Frequence" AS ENUM ('HEBDOMADAIRE', 'MENSUEL');

-- CreateEnum
CREATE TYPE "StatutTontine" AS ENUM ('ACTIVE', 'TERMINEE', 'SUSPENDUE');

-- CreateEnum
CREATE TYPE "StatutCredit" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE', 'REMBOURSE_PARTIEL', 'REMBOURSE_TOTAL');

-- CreateEnum
CREATE TYPE "TransactionCreditType" AS ENUM ('DECAISSEMENT', 'REMBOURSEMENT');

-- CreateEnum
CREATE TYPE "StatutCreditAlim" AS ENUM ('ACTIF', 'EPUISE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "TypeCreditAlim" AS ENUM ('UTILISATION', 'ANNULATION', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "TypePaiement" AS ENUM ('WALLET_GENERAL', 'WALLET_TONTINE', 'WALLET_CREDIT', 'EXTERNE');

-- CreateEnum
CREATE TYPE "TypeFacture" AS ENUM ('COTISATION', 'TONTINE', 'CREDIT', 'CREDIT_ALIMENTAIRE', 'ACHAT');

-- CreateEnum
CREATE TYPE "StatutFacture" AS ENUM ('BROUILLON', 'PAYEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "photo" TEXT,
    "role" "Role" DEFAULT 'USER',
    "telephone" TEXT,
    "adresse" TEXT,
    "passwordHash" TEXT NOT NULL,
    "etat" "MemberStatus" NOT NULL DEFAULT 'ACTIF',
    "dateAdhesion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gestionnaire" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "role" "RoleGestionnaire" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotisation" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "periode" "PeriodeCotisation" NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "statut" "StatutCotisation" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tontine" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "montantCycle" DECIMAL(65,30) NOT NULL,
    "frequence" "Frequence" NOT NULL,
    "statut" "StatutTontine" NOT NULL DEFAULT 'ACTIVE',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
CREATE TABLE "Credit" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "montantRestant" DECIMAL(65,30) NOT NULL,
    "dateDemande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutCredit" NOT NULL DEFAULT 'EN_ATTENTE',
    "scoreRisque" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TransactionCreditType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAlimentaire" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "plafond" DECIMAL(65,30) NOT NULL,
    "montantUtilise" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantRestant" DECIMAL(65,30) NOT NULL,
    "dateAttribution" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateExpiration" TIMESTAMP(3),
    "statut" "StatutCreditAlim" NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAlimentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenteCreditAlimentaire" (
    "id" SERIAL NOT NULL,
    "creditAlimentaireId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenteCreditAlimentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAlimentaireTransaction" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TypeCreditAlim" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAlimentaireTransaction_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "factureId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TypePaiement" NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TypeFacture" NOT NULL,
    "statut" "StatutFacture" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametre" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_memberId_key" ON "Wallet"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Gestionnaire_memberId_key" ON "Gestionnaire"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MouvementStock_reference_key" ON "MouvementStock"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_reference_key" ON "Facture"("reference");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gestionnaire" ADD CONSTRAINT "Gestionnaire_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineMembre" ADD CONSTRAINT "TontineMembre_tontineId_fkey" FOREIGN KEY ("tontineId") REFERENCES "Tontine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineMembre" ADD CONSTRAINT "TontineMembre_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAlimentaire" ADD CONSTRAINT "CreditAlimentaire_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteCreditAlimentaire" ADD CONSTRAINT "VenteCreditAlimentaire_creditAlimentaireId_fkey" FOREIGN KEY ("creditAlimentaireId") REFERENCES "CreditAlimentaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteCreditAlimentaire" ADD CONSTRAINT "VenteCreditAlimentaire_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAlimentaireTransaction" ADD CONSTRAINT "CreditAlimentaireTransaction_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CreditAlimentaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
