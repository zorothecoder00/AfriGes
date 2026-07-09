-- CreateEnum
CREATE TYPE "NiveauFidelite" AS ENUM ('BRONZE', 'ARGENT', 'OR', 'PLATINE');

-- CreateEnum
CREATE TYPE "TypeTransactionFidelite" AS ENUM ('GAIN', 'BONUS', 'DEPENSE', 'AJUSTEMENT');

-- CreateTable
CREATE TABLE "ProgrammeFidelite" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "pointsParMontant" INTEGER NOT NULL DEFAULT 1000,
    "bonusParDepot" INTEGER NOT NULL DEFAULT 0,
    "seuilArgent" INTEGER NOT NULL DEFAULT 500,
    "seuilOr" INTEGER NOT NULL DEFAULT 2000,
    "seuilPlatine" INTEGER NOT NULL DEFAULT 5000,
    "reductionFraisArgent" INTEGER NOT NULL DEFAULT 0,
    "reductionFraisOr" INTEGER NOT NULL DEFAULT 5,
    "reductionFraisPlatine" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeFidelite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompteFidelite" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "soldePoints" INTEGER NOT NULL DEFAULT 0,
    "totalGagnes" INTEGER NOT NULL DEFAULT 0,
    "totalUtilises" INTEGER NOT NULL DEFAULT 0,
    "niveau" "NiveauFidelite" NOT NULL DEFAULT 'BRONZE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompteFidelite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionFidelite" (
    "id" SERIAL NOT NULL,
    "compteFideliteId" INTEGER NOT NULL,
    "type" "TypeTransactionFidelite" NOT NULL,
    "points" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "source" TEXT,
    "mouvementId" INTEGER,
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionFidelite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompteFidelite_clientId_key" ON "CompteFidelite"("clientId");

-- CreateIndex
CREATE INDEX "CompteFidelite_niveau_idx" ON "CompteFidelite"("niveau");

-- CreateIndex
CREATE INDEX "TransactionFidelite_compteFideliteId_idx" ON "TransactionFidelite"("compteFideliteId");

-- CreateIndex
CREATE INDEX "TransactionFidelite_createdAt_idx" ON "TransactionFidelite"("createdAt");

-- AddForeignKey
ALTER TABLE "CompteFidelite" ADD CONSTRAINT "CompteFidelite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFidelite" ADD CONSTRAINT "TransactionFidelite_compteFideliteId_fkey" FOREIGN KEY ("compteFideliteId") REFERENCES "CompteFidelite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionFidelite" ADD CONSTRAINT "TransactionFidelite_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
