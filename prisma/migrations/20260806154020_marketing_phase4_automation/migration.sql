-- CreateEnum
CREATE TYPE "DeclencheurAutomatisation" AS ENUM ('NOUVEAU_CLIENT', 'PREMIER_ACHAT', 'ACHAT_PRODUIT', 'PANIER_ELEVE', 'CLIENT_INACTIF', 'ANNIVERSAIRE');

-- CreateEnum
CREATE TYPE "ActionAutomatisation" AS ENUM ('ENVOYER_SMS', 'ENVOYER_EMAIL', 'ENVOYER_WHATSAPP', 'NOTIFICATION_INTERNE', 'ATTRIBUER_COMMERCIAL', 'CREER_TACHE', 'AJOUTER_TAG', 'RETIRER_TAG', 'ATTRIBUER_POINTS', 'DECLENCHER_CAMPAGNE');

-- CreateEnum
CREATE TYPE "StatutExecutionAutomatisation" AS ENUM ('EN_COURS', 'TERMINEE', 'ARRETEE');

-- CreateEnum
CREATE TYPE "StatutTacheMarketing" AS ENUM ('A_FAIRE', 'TERMINEE');

-- CreateTable
CREATE TABLE "RegleAutomatisation" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "declencheur" "DeclencheurAutomatisation" NOT NULL,
    "declencheurParams" JSONB,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegleAutomatisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapeAutomatisation" (
    "id" SERIAL NOT NULL,
    "regleId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "delaiJours" INTEGER NOT NULL DEFAULT 0,
    "action" "ActionAutomatisation" NOT NULL,
    "actionParams" JSONB NOT NULL,
    "arreterSiAchatEntreTemps" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EtapeAutomatisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionAutomatisation" (
    "id" SERIAL NOT NULL,
    "regleId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "statut" "StatutExecutionAutomatisation" NOT NULL DEFAULT 'EN_COURS',
    "etapeCouranteOrdre" INTEGER NOT NULL DEFAULT 1,
    "dateProchaineFenetre" TIMESTAMP(3) NOT NULL,
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "ExecutionAutomatisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAutomatisation" (
    "id" SERIAL NOT NULL,
    "executionId" INTEGER NOT NULL,
    "etapeId" INTEGER NOT NULL,
    "statut" TEXT NOT NULL,
    "detail" TEXT,
    "dateExecution" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAutomatisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacheMarketing" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "clientId" INTEGER,
    "assigneAId" INTEGER NOT NULL,
    "statut" "StatutTacheMarketing" NOT NULL DEFAULT 'A_FAIRE',
    "dateEcheance" TIMESTAMP(3),
    "executionId" INTEGER,
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TacheMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegleAutomatisation_declencheur_actif_idx" ON "RegleAutomatisation"("declencheur", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "EtapeAutomatisation_regleId_ordre_key" ON "EtapeAutomatisation"("regleId", "ordre");

-- CreateIndex
CREATE INDEX "ExecutionAutomatisation_statut_dateProchaineFenetre_idx" ON "ExecutionAutomatisation"("statut", "dateProchaineFenetre");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionAutomatisation_regleId_clientId_key" ON "ExecutionAutomatisation"("regleId", "clientId");

-- CreateIndex
CREATE INDEX "TacheMarketing_assigneAId_statut_idx" ON "TacheMarketing"("assigneAId", "statut");

-- AddForeignKey
ALTER TABLE "RegleAutomatisation" ADD CONSTRAINT "RegleAutomatisation_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapeAutomatisation" ADD CONSTRAINT "EtapeAutomatisation_regleId_fkey" FOREIGN KEY ("regleId") REFERENCES "RegleAutomatisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionAutomatisation" ADD CONSTRAINT "ExecutionAutomatisation_regleId_fkey" FOREIGN KEY ("regleId") REFERENCES "RegleAutomatisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionAutomatisation" ADD CONSTRAINT "ExecutionAutomatisation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAutomatisation" ADD CONSTRAINT "LogAutomatisation_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ExecutionAutomatisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAutomatisation" ADD CONSTRAINT "LogAutomatisation_etapeId_fkey" FOREIGN KEY ("etapeId") REFERENCES "EtapeAutomatisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheMarketing" ADD CONSTRAINT "TacheMarketing_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheMarketing" ADD CONSTRAINT "TacheMarketing_assigneAId_fkey" FOREIGN KEY ("assigneAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheMarketing" ADD CONSTRAINT "TacheMarketing_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ExecutionAutomatisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheMarketing" ADD CONSTRAINT "TacheMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
