-- CreateEnum
CREATE TYPE "StatutCredit" AS ENUM ('EN_ATTENTE_VALIDATION', 'VALIDE', 'ACTIF', 'EN_RETARD', 'SOLDE', 'ANNULE', 'REJETE');

-- CreateEnum
CREATE TYPE "StatutEcheanceCredit" AS ENUM ('EN_ATTENTE', 'PAYE', 'PARTIEL', 'EN_RETARD');

-- CreateTable
CREATE TABLE "CreditClient" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "statut" "StatutCredit" NOT NULL DEFAULT 'EN_ATTENTE_VALIDATION',
    "montantTotal" DECIMAL(65,30) NOT NULL,
    "montantRembourse" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "soldeRestant" DECIMAL(65,30) NOT NULL,
    "dureeJours" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateEcheanceFin" TIMESTAMP(3) NOT NULL,
    "montantJournalier" DECIMAL(65,30) NOT NULL,
    "tauxPenalite" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "garantie" TEXT,
    "observations" TEXT,
    "creeParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCreditClient" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "produitId" INTEGER,
    "produitNom" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "remise" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantLigne" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneCreditClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcheanceCredit" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "numeroEcheance" INTEGER NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "montantDu" DECIMAL(65,30) NOT NULL,
    "montantPaye" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutEcheanceCredit" NOT NULL DEFAULT 'EN_ATTENTE',
    "penalite" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "EcheanceCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemboursementCredit" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "dateRemboursement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modePaiement" "TypePaiement" NOT NULL DEFAULT 'ESPECES',
    "notes" TEXT,
    "enregistreParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemboursementCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditClient_reference_key" ON "CreditClient"("reference");

-- CreateIndex
CREATE INDEX "CreditClient_clientId_idx" ON "CreditClient"("clientId");

-- CreateIndex
CREATE INDEX "CreditClient_statut_idx" ON "CreditClient"("statut");

-- CreateIndex
CREATE INDEX "CreditClient_pointDeVenteId_idx" ON "CreditClient"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "CreditClient_dateDebut_idx" ON "CreditClient"("dateDebut");

-- CreateIndex
CREATE INDEX "LigneCreditClient_creditId_idx" ON "LigneCreditClient"("creditId");

-- CreateIndex
CREATE INDEX "LigneCreditClient_produitId_idx" ON "LigneCreditClient"("produitId");

-- CreateIndex
CREATE INDEX "EcheanceCredit_creditId_idx" ON "EcheanceCredit"("creditId");

-- CreateIndex
CREATE INDEX "EcheanceCredit_statut_idx" ON "EcheanceCredit"("statut");

-- CreateIndex
CREATE INDEX "EcheanceCredit_dateEcheance_idx" ON "EcheanceCredit"("dateEcheance");

-- CreateIndex
CREATE INDEX "EcheanceCredit_creditId_statut_idx" ON "EcheanceCredit"("creditId", "statut");

-- CreateIndex
CREATE INDEX "RemboursementCredit_creditId_idx" ON "RemboursementCredit"("creditId");

-- CreateIndex
CREATE INDEX "RemboursementCredit_dateRemboursement_idx" ON "RemboursementCredit"("dateRemboursement");

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCreditClient" ADD CONSTRAINT "LigneCreditClient_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CreditClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCreditClient" ADD CONSTRAINT "LigneCreditClient_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcheanceCredit" ADD CONSTRAINT "EcheanceCredit_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CreditClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemboursementCredit" ADD CONSTRAINT "RemboursementCredit_enregistreParId_fkey" FOREIGN KEY ("enregistreParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemboursementCredit" ADD CONSTRAINT "RemboursementCredit_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CreditClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
