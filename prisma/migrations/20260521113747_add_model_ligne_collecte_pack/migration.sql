-- CreateEnum
CREATE TYPE "StatutCollecte" AS ENUM ('EN_COURS', 'VALIDEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutLigneCollecte" AS ENUM ('EN_ATTENTE', 'COLLECTE', 'PARTIEL', 'ECHEC');

-- CreateTable
CREATE TABLE "CollecteJournaliere" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "agentId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "dateCollecte" TIMESTAMP(3) NOT NULL,
    "statut" "StatutCollecte" NOT NULL DEFAULT 'EN_COURS',
    "montantPrevu" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantCollecte" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollecteJournaliere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCollecte" (
    "id" SERIAL NOT NULL,
    "collecteId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "souscriptionId" INTEGER NOT NULL,
    "montantAttendu" DECIMAL(65,30) NOT NULL,
    "montantCollecte" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutLigneCollecte" NOT NULL DEFAULT 'EN_ATTENTE',
    "notes" TEXT,
    "versementPackId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneCollecte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollecteJournaliere_reference_key" ON "CollecteJournaliere"("reference");

-- CreateIndex
CREATE INDEX "CollecteJournaliere_agentId_idx" ON "CollecteJournaliere"("agentId");

-- CreateIndex
CREATE INDEX "CollecteJournaliere_statut_idx" ON "CollecteJournaliere"("statut");

-- CreateIndex
CREATE INDEX "CollecteJournaliere_dateCollecte_idx" ON "CollecteJournaliere"("dateCollecte");

-- CreateIndex
CREATE INDEX "CollecteJournaliere_pointDeVenteId_idx" ON "CollecteJournaliere"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "LigneCollecte_versementPackId_key" ON "LigneCollecte"("versementPackId");

-- CreateIndex
CREATE INDEX "LigneCollecte_collecteId_idx" ON "LigneCollecte"("collecteId");

-- CreateIndex
CREATE INDEX "LigneCollecte_clientId_idx" ON "LigneCollecte"("clientId");

-- CreateIndex
CREATE INDEX "LigneCollecte_souscriptionId_idx" ON "LigneCollecte"("souscriptionId");

-- AddForeignKey
ALTER TABLE "CollecteJournaliere" ADD CONSTRAINT "CollecteJournaliere_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollecteJournaliere" ADD CONSTRAINT "CollecteJournaliere_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollecteJournaliere" ADD CONSTRAINT "CollecteJournaliere_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCollecte" ADD CONSTRAINT "LigneCollecte_collecteId_fkey" FOREIGN KEY ("collecteId") REFERENCES "CollecteJournaliere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCollecte" ADD CONSTRAINT "LigneCollecte_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCollecte" ADD CONSTRAINT "LigneCollecte_souscriptionId_fkey" FOREIGN KEY ("souscriptionId") REFERENCES "SouscriptionPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCollecte" ADD CONSTRAINT "LigneCollecte_versementPackId_fkey" FOREIGN KEY ("versementPackId") REFERENCES "VersementPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
