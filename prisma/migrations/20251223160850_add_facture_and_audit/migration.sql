-- CreateEnum
CREATE TYPE "TypeFacture" AS ENUM ('COTISATION', 'TONTINE', 'CREDIT', 'CREDIT_ALIMENTAIRE', 'ACHAT');

-- CreateEnum
CREATE TYPE "StatutFacture" AS ENUM ('BROUILLON', 'PAYEE', 'ANNULEE');

-- AlterTable
ALTER TABLE "Cotisation" ALTER COLUMN "montant" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "CreditAlimentaire" ALTER COLUMN "montantUtilise" SET DEFAULT 0,
ALTER COLUMN "montantUtilise" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "montantRestant" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Tontine" ALTER COLUMN "montantCycle" SET DATA TYPE DECIMAL(65,30);

-- CreateTable
CREATE TABLE "VenteCreditAlimentaire" (
    "id" SERIAL NOT NULL,
    "creditAlimentaireId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenteCreditAlimentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TypeFacture" NOT NULL,
    "statut" "StatutFacture" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametre" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE UNIQUE INDEX "Facture_reference_key" ON "Facture"("reference");

-- AddForeignKey
ALTER TABLE "VenteCreditAlimentaire" ADD CONSTRAINT "VenteCreditAlimentaire_creditAlimentaireId_fkey" FOREIGN KEY ("creditAlimentaireId") REFERENCES "CreditAlimentaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteCreditAlimentaire" ADD CONSTRAINT "VenteCreditAlimentaire_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
