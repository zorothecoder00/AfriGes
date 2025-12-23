-- CreateEnum
CREATE TYPE "TypePaiement" AS ENUM ('WALLET_GENERAL', 'WALLET_TONTINE', 'WALLET_CREDIT', 'EXTERNE');

-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "factureId" INTEGER NOT NULL,
    "walletId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TypePaiement" NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
