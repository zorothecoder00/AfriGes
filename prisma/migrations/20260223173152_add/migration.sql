-- CreateEnum
CREATE TYPE "TypePack" AS ENUM ('ALIMENTAIRE', 'REVENDEUR', 'FAMILIAL', 'URGENCE', 'EPARGNE_PRODUIT', 'FIDELITE');

-- CreateEnum
CREATE TYPE "FormuleRevendeur" AS ENUM ('FORMULE_1', 'FORMULE_2');

-- CreateEnum
CREATE TYPE "FrequenceVersement" AS ENUM ('QUOTIDIEN', 'HEBDOMADAIRE', 'BIMENSUEL', 'MENSUEL');

-- CreateEnum
CREATE TYPE "StatutSouscription" AS ENUM ('EN_ATTENTE', 'ACTIF', 'SUSPENDU', 'COMPLETE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeVersement" AS ENUM ('COTISATION_INITIALE', 'VERSEMENT_PERIODIQUE', 'REMBOURSEMENT', 'BONUS', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "StatutVersementPack" AS ENUM ('EN_ATTENTE', 'PAYE', 'ANNULE', 'EN_RETARD');

-- CreateEnum
CREATE TYPE "StatutReceptionPack" AS ENUM ('PLANIFIEE', 'LIVREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeMouvementPoints" AS ENUM ('GAIN', 'UTILISATION', 'EXPIRATION', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "TypeRecompense" AS ENUM ('REDUCTION', 'PRODUIT_GRATUIT', 'CASHBACK');

-- CreateEnum
CREATE TYPE "StatutRecompense" AS ENUM ('DISPONIBLE', 'UTILISEE', 'EXPIREE');

-- CreateTable
CREATE TABLE "Pack" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypePack" NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dureeJours" INTEGER,
    "frequenceVersement" "FrequenceVersement" NOT NULL DEFAULT 'HEBDOMADAIRE',
    "montantVersement" DECIMAL(65,30),
    "formuleRevendeur" "FormuleRevendeur",
    "montantCredit" DECIMAL(65,30),
    "montantSeuil" DECIMAL(65,30),
    "bonusPourcentage" DECIMAL(65,30),
    "cyclesBonusTrigger" INTEGER,
    "acomptePercent" DECIMAL(65,30),
    "pointsParTranche" INTEGER,
    "montantTranche" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SouscriptionPack" (
    "id" SERIAL NOT NULL,
    "packId" INTEGER NOT NULL,
    "userId" INTEGER,
    "clientId" INTEGER,
    "statut" "StatutSouscription" NOT NULL DEFAULT 'EN_ATTENTE',
    "formuleRevendeur" "FormuleRevendeur",
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "dateCloture" TIMESTAMP(3),
    "montantTotal" DECIMAL(65,30) NOT NULL,
    "montantVerse" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantRestant" DECIMAL(65,30) NOT NULL,
    "numeroCycle" INTEGER NOT NULL DEFAULT 1,
    "bonusObtenu" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "enregistrePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SouscriptionPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersementPack" (
    "id" SERIAL NOT NULL,
    "souscriptionId" INTEGER NOT NULL,
    "type" "TypeVersement" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "statut" "StatutVersementPack" NOT NULL DEFAULT 'PAYE',
    "datePrevue" TIMESTAMP(3),
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "encaisseParId" INTEGER,
    "encaisseParNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VersementPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcheancePack" (
    "id" SERIAL NOT NULL,
    "souscriptionId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "datePrevue" TIMESTAMP(3) NOT NULL,
    "datePaiement" TIMESTAMP(3),
    "statut" "StatutVersementPack" NOT NULL DEFAULT 'EN_ATTENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcheancePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceptionProduitPack" (
    "id" SERIAL NOT NULL,
    "souscriptionId" INTEGER NOT NULL,
    "statut" "StatutReceptionPack" NOT NULL DEFAULT 'PLANIFIEE',
    "datePrevisionnelle" TIMESTAMP(3) NOT NULL,
    "dateLivraison" TIMESTAMP(3),
    "livreurNom" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceptionProduitPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneReceptionPack" (
    "id" SERIAL NOT NULL,
    "receptionId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneReceptionPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsFidelite" (
    "id" SERIAL NOT NULL,
    "solde" INTEGER NOT NULL DEFAULT 0,
    "totalGagne" INTEGER NOT NULL DEFAULT 0,
    "totalUtilise" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER,
    "clientId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointsFidelite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementPoints" (
    "id" SERIAL NOT NULL,
    "pointsFideliteId" INTEGER NOT NULL,
    "type" "TypeMouvementPoints" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "referenceId" INTEGER,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecompenseFidelite" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeRecompense" NOT NULL,
    "coutPoints" INTEGER NOT NULL,
    "valeur" DECIMAL(65,30),
    "produitId" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateExpiration" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecompenseFidelite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilisationRecompense" (
    "id" SERIAL NOT NULL,
    "recompenseId" INTEGER NOT NULL,
    "pointsFideliteId" INTEGER NOT NULL,
    "pointsUtilises" INTEGER NOT NULL,
    "statut" "StatutRecompense" NOT NULL DEFAULT 'DISPONIBLE',
    "dateUtilisation" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilisationRecompense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VersementPack_reference_key" ON "VersementPack"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "EcheancePack_souscriptionId_numero_key" ON "EcheancePack"("souscriptionId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "PointsFidelite_userId_key" ON "PointsFidelite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PointsFidelite_clientId_key" ON "PointsFidelite"("clientId");

-- AddForeignKey
ALTER TABLE "SouscriptionPack" ADD CONSTRAINT "SouscriptionPack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SouscriptionPack" ADD CONSTRAINT "SouscriptionPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SouscriptionPack" ADD CONSTRAINT "SouscriptionPack_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersementPack" ADD CONSTRAINT "VersementPack_souscriptionId_fkey" FOREIGN KEY ("souscriptionId") REFERENCES "SouscriptionPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcheancePack" ADD CONSTRAINT "EcheancePack_souscriptionId_fkey" FOREIGN KEY ("souscriptionId") REFERENCES "SouscriptionPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionProduitPack" ADD CONSTRAINT "ReceptionProduitPack_souscriptionId_fkey" FOREIGN KEY ("souscriptionId") REFERENCES "SouscriptionPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReceptionPack" ADD CONSTRAINT "LigneReceptionPack_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "ReceptionProduitPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReceptionPack" ADD CONSTRAINT "LigneReceptionPack_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsFidelite" ADD CONSTRAINT "PointsFidelite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsFidelite" ADD CONSTRAINT "PointsFidelite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementPoints" ADD CONSTRAINT "MouvementPoints_pointsFideliteId_fkey" FOREIGN KEY ("pointsFideliteId") REFERENCES "PointsFidelite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecompenseFidelite" ADD CONSTRAINT "RecompenseFidelite_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationRecompense" ADD CONSTRAINT "UtilisationRecompense_recompenseId_fkey" FOREIGN KEY ("recompenseId") REFERENCES "RecompenseFidelite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationRecompense" ADD CONSTRAINT "UtilisationRecompense_pointsFideliteId_fkey" FOREIGN KEY ("pointsFideliteId") REFERENCES "PointsFidelite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
