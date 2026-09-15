-- CreateEnum
CREATE TYPE "TypeDevisProforma" AS ENUM ('DEVIS', 'PROFORMA');

-- CreateEnum
CREATE TYPE "StatutDevisProforma" AS ENUM ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE', 'EXPIRE');

-- CreateTable
CREATE TABLE "DevisProforma" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TypeDevisProforma" NOT NULL DEFAULT 'DEVIS',
    "statut" "StatutDevisProforma" NOT NULL DEFAULT 'BROUILLON',
    "agentId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "dateValidite" TIMESTAMP(3) NOT NULL,
    "conditions" TEXT,
    "totalHT" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRemise" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTVA" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tokenReponse" TEXT NOT NULL,
    "dateEnvoi" TIMESTAMP(3),
    "dateReponse" TIMESTAMP(3),
    "nomSignataireReponse" TEXT,
    "motifRefus" TEXT,
    "devisOrigineId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevisProforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneDevisProforma" (
    "id" SERIAL NOT NULL,
    "devisProformaId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "remisePourcent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remiseMontant" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalLigne" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneDevisProforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DevisProforma_reference_key" ON "DevisProforma"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "DevisProforma_tokenReponse_key" ON "DevisProforma"("tokenReponse");

-- CreateIndex
CREATE UNIQUE INDEX "DevisProforma_devisOrigineId_key" ON "DevisProforma"("devisOrigineId");

-- CreateIndex
CREATE INDEX "DevisProforma_statut_idx" ON "DevisProforma"("statut");

-- CreateIndex
CREATE INDEX "DevisProforma_type_idx" ON "DevisProforma"("type");

-- CreateIndex
CREATE INDEX "DevisProforma_pointDeVenteId_idx" ON "DevisProforma"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "DevisProforma_clientId_idx" ON "DevisProforma"("clientId");

-- CreateIndex
CREATE INDEX "LigneDevisProforma_devisProformaId_idx" ON "LigneDevisProforma"("devisProformaId");

-- AddForeignKey
ALTER TABLE "DevisProforma" ADD CONSTRAINT "DevisProforma_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevisProforma" ADD CONSTRAINT "DevisProforma_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevisProforma" ADD CONSTRAINT "DevisProforma_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevisProforma" ADD CONSTRAINT "DevisProforma_devisOrigineId_fkey" FOREIGN KEY ("devisOrigineId") REFERENCES "DevisProforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDevisProforma" ADD CONSTRAINT "LigneDevisProforma_devisProformaId_fkey" FOREIGN KEY ("devisProformaId") REFERENCES "DevisProforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDevisProforma" ADD CONSTRAINT "LigneDevisProforma_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
