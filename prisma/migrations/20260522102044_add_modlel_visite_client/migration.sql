-- CreateEnum
CREATE TYPE "StatutVisite" AS ENUM ('PLANIFIEE', 'REALISEE', 'ANNULEE');

-- AlterTable
ALTER TABLE "Gestionnaire" ADD COLUMN     "zone" TEXT;

-- CreateTable
CREATE TABLE "VisiteClient" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "statut" "StatutVisite" NOT NULL DEFAULT 'REALISEE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "dateVisite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisiteClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisiteClient_agentId_idx" ON "VisiteClient"("agentId");

-- CreateIndex
CREATE INDEX "VisiteClient_clientId_idx" ON "VisiteClient"("clientId");

-- CreateIndex
CREATE INDEX "VisiteClient_dateVisite_idx" ON "VisiteClient"("dateVisite");

-- AddForeignKey
ALTER TABLE "VisiteClient" ADD CONSTRAINT "VisiteClient_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisiteClient" ADD CONSTRAINT "VisiteClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
