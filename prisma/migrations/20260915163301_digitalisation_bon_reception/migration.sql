-- CreateEnum
CREATE TYPE "StatutBonReception" AS ENUM ('EN_ATTENTE_SIGNATURE', 'SIGNE', 'LITIGE');

-- CreateEnum
CREATE TYPE "EtatMarchandiseReception" AS ENUM ('CONFORME', 'NON_CONFORME');

-- CreateTable
CREATE TABLE "BonReception" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutBonReception" NOT NULL DEFAULT 'EN_ATTENTE_SIGNATURE',
    "bonSortieId" INTEGER NOT NULL,
    "commandeClientId" INTEGER NOT NULL,
    "clientNom" TEXT NOT NULL,
    "clientTelephone" TEXT NOT NULL,
    "clientAdresse" TEXT,
    "etatMarchandise" "EtatMarchandiseReception",
    "reserve" TEXT,
    "ecartConstate" BOOLEAN NOT NULL DEFAULT false,
    "tokenConfirmation" TEXT NOT NULL,
    "dateEnvoiLien" TIMESTAMP(3),
    "signatureClientNom" TEXT,
    "dateSignatureClient" TIMESTAMP(3),
    "signatureClientPieceIdentite" TEXT,
    "livreurId" INTEGER,
    "dateSignatureLivreur" TIMESTAMP(3),
    "latitudeLivraison" DOUBLE PRECISION,
    "longitudeLivraison" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonReception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonReception" (
    "id" SERIAL NOT NULL,
    "bonReceptionId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantiteCommandee" INTEGER NOT NULL,
    "quantiteLivree" INTEGER NOT NULL,

    CONSTRAINT "LigneBonReception_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonReception_reference_key" ON "BonReception"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "BonReception_bonSortieId_key" ON "BonReception"("bonSortieId");

-- CreateIndex
CREATE UNIQUE INDEX "BonReception_commandeClientId_key" ON "BonReception"("commandeClientId");

-- CreateIndex
CREATE UNIQUE INDEX "BonReception_tokenConfirmation_key" ON "BonReception"("tokenConfirmation");

-- CreateIndex
CREATE INDEX "BonReception_statut_idx" ON "BonReception"("statut");

-- CreateIndex
CREATE INDEX "LigneBonReception_bonReceptionId_idx" ON "LigneBonReception"("bonReceptionId");

-- AddForeignKey
ALTER TABLE "BonReception" ADD CONSTRAINT "BonReception_bonSortieId_fkey" FOREIGN KEY ("bonSortieId") REFERENCES "BonSortie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonReception" ADD CONSTRAINT "BonReception_commandeClientId_fkey" FOREIGN KEY ("commandeClientId") REFERENCES "CommandeClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonReception" ADD CONSTRAINT "BonReception_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonReception" ADD CONSTRAINT "LigneBonReception_bonReceptionId_fkey" FOREIGN KEY ("bonReceptionId") REFERENCES "BonReception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonReception" ADD CONSTRAINT "LigneBonReception_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
