-- CreateEnum
CREATE TYPE "TypeChargeProduitAttente" AS ENUM ('CHARGE_A_PAYER', 'PRODUIT_A_RECEVOIR');

-- CreateEnum
CREATE TYPE "StatutChargeProduitAttente" AS ENUM ('EN_ATTENTE', 'EXTOURNEE');

-- CreateTable
CREATE TABLE "ChargeProduitAttente" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" "TypeChargeProduitAttente" NOT NULL,
    "compteChargeOuProduitId" INTEGER NOT NULL,
    "compteAttenteId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "dateConstatation" TIMESTAMP(3) NOT NULL,
    "statut" "StatutChargeProduitAttente" NOT NULL DEFAULT 'EN_ATTENTE',
    "ecritureConstatationId" INTEGER,
    "ecritureExtourneId" INTEGER,
    "dateExtourne" TIMESTAMP(3),
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargeProduitAttente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargeProduitAttente_statut_idx" ON "ChargeProduitAttente"("statut");

-- CreateIndex
CREATE INDEX "ChargeProduitAttente_type_idx" ON "ChargeProduitAttente"("type");

-- AddForeignKey
ALTER TABLE "ChargeProduitAttente" ADD CONSTRAINT "ChargeProduitAttente_compteChargeOuProduitId_fkey" FOREIGN KEY ("compteChargeOuProduitId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeProduitAttente" ADD CONSTRAINT "ChargeProduitAttente_compteAttenteId_fkey" FOREIGN KEY ("compteAttenteId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeProduitAttente" ADD CONSTRAINT "ChargeProduitAttente_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
