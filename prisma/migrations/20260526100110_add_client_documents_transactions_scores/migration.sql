-- CreateEnum
CREATE TYPE "TypeDocumentClient" AS ENUM ('CNI', 'PASSEPORT', 'CONTRAT', 'PHOTO_IDENTITE', 'ATTESTATION', 'RECU', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeTransactionClient" AS ENUM ('VERSEMENT_PACK', 'REMBOURSEMENT_CREDIT', 'VENTE_DIRECTE', 'COLLECTE_JOURNALIERE', 'AUTRE');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "details" JSONB,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "type" "TypeDocumentClient" NOT NULL DEFAULT 'AUTRE',
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadthingKey" TEXT,
    "taille" INTEGER,
    "description" TEXT,
    "expireAt" TIMESTAMP(3),
    "uploadePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTransaction" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "type" "TypeTransactionClient" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "sens" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "sourceType" TEXT,
    "sourceId" INTEGER,
    "agentId" INTEGER,
    "dateOperation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientScoreHistorique" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "niveauRisque" "NiveauRisque" NOT NULL,
    "scoreSolvabilite" DOUBLE PRECISION NOT NULL,
    "raison" TEXT,
    "calculePar" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientScoreHistorique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_idx" ON "ClientDocument"("clientId");

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_type_idx" ON "ClientDocument"("clientId", "type");

-- CreateIndex
CREATE INDEX "ClientTransaction_clientId_idx" ON "ClientTransaction"("clientId");

-- CreateIndex
CREATE INDEX "ClientTransaction_clientId_type_idx" ON "ClientTransaction"("clientId", "type");

-- CreateIndex
CREATE INDEX "ClientTransaction_clientId_dateOperation_idx" ON "ClientTransaction"("clientId", "dateOperation");

-- CreateIndex
CREATE INDEX "ClientTransaction_sourceType_sourceId_idx" ON "ClientTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ClientScoreHistorique_clientId_idx" ON "ClientScoreHistorique"("clientId");

-- CreateIndex
CREATE INDEX "ClientScoreHistorique_clientId_createdAt_idx" ON "ClientScoreHistorique"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entite_entiteId_idx" ON "AuditLog"("entite", "entiteId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_uploadePar_fkey" FOREIGN KEY ("uploadePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTransaction" ADD CONSTRAINT "ClientTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTransaction" ADD CONSTRAINT "ClientTransaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientScoreHistorique" ADD CONSTRAINT "ClientScoreHistorique_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientScoreHistorique" ADD CONSTRAINT "ClientScoreHistorique_calculePar_fkey" FOREIGN KEY ("calculePar") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
