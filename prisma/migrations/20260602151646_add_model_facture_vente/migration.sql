-- CreateEnum
CREATE TYPE "TypeFactureVente" AS ENUM ('COMPTANT', 'CREDIT', 'PRO_FORMA');

-- CreateEnum
CREATE TYPE "StatutFactureVente" AS ENUM ('EMISE', 'ANNULEE');

-- CreateTable
CREATE TABLE "FactureVente" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "type" "TypeFactureVente" NOT NULL,
    "statut" "StatutFactureVente" NOT NULL DEFAULT 'EMISE',
    "venteDirecteId" INTEGER,
    "creditClientId" INTEGER,
    "pointDeVenteId" INTEGER,
    "pdvNom" TEXT,
    "pdvAdresse" TEXT,
    "pdvTelephone" TEXT,
    "clientId" INTEGER,
    "clientNom" TEXT NOT NULL,
    "clientTelephone" TEXT,
    "clientAdresse" TEXT,
    "emiseParId" INTEGER NOT NULL,
    "emiseParNom" TEXT NOT NULL,
    "montantHT" DECIMAL(65,30) NOT NULL,
    "montantTVA" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantTTC" DECIMAL(65,30) NOT NULL,
    "montantPaye" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "modePaiement" TEXT,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactureVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneFactureVente" (
    "id" SERIAL NOT NULL,
    "factureId" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneFactureVente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FactureVente_numero_key" ON "FactureVente"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "FactureVente_venteDirecteId_key" ON "FactureVente"("venteDirecteId");

-- CreateIndex
CREATE INDEX "FactureVente_emiseParId_idx" ON "FactureVente"("emiseParId");

-- CreateIndex
CREATE INDEX "FactureVente_clientId_idx" ON "FactureVente"("clientId");

-- CreateIndex
CREATE INDEX "FactureVente_pointDeVenteId_idx" ON "FactureVente"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "FactureVente_creditClientId_idx" ON "FactureVente"("creditClientId");

-- CreateIndex
CREATE INDEX "FactureVente_type_idx" ON "FactureVente"("type");

-- CreateIndex
CREATE INDEX "FactureVente_statut_idx" ON "FactureVente"("statut");

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_venteDirecteId_fkey" FOREIGN KEY ("venteDirecteId") REFERENCES "VenteDirecte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_creditClientId_fkey" FOREIGN KEY ("creditClientId") REFERENCES "CreditClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureVente" ADD CONSTRAINT "FactureVente_emiseParId_fkey" FOREIGN KEY ("emiseParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneFactureVente" ADD CONSTRAINT "LigneFactureVente_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "FactureVente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
