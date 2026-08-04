-- CreateEnum
CREATE TYPE "TypeProvision" AS ENUM ('PROVISION_RISQUE_CHARGE', 'DEPRECIATION_STOCK', 'DEPRECIATION_CLIENT', 'DEPRECIATION_IMMOBILISATION');

-- CreateEnum
CREATE TYPE "StatutProvision" AS ENUM ('ACTIVE', 'PARTIELLEMENT_REPRISE', 'SOLDEE');

-- CreateEnum
CREATE TYPE "TypeMouvementProvision" AS ENUM ('DOTATION', 'REPRISE');

-- CreateEnum
CREATE TYPE "TypeRegularisation" AS ENUM ('CHARGE_CONSTATEE_AVANCE', 'PRODUIT_CONSTATE_AVANCE');

-- CreateEnum
CREATE TYPE "StatutRegularisation" AS ENUM ('ACTIVE', 'SOLDEE');

-- AlterTable
ALTER TABLE "InventaireSite" ADD COLUMN     "ecritureRegularisationId" INTEGER;

-- CreateTable
CREATE TABLE "ProvisionDepreciation" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" "TypeProvision" NOT NULL,
    "compteProvisionId" INTEGER NOT NULL,
    "compteDotationId" INTEGER NOT NULL,
    "compteRepriseId" INTEGER NOT NULL,
    "montantInitial" DECIMAL(65,30) NOT NULL,
    "montantActuel" DECIMAL(65,30) NOT NULL,
    "motif" TEXT NOT NULL,
    "dateConstitution" TIMESTAMP(3) NOT NULL,
    "statut" "StatutProvision" NOT NULL DEFAULT 'ACTIVE',
    "clientId" INTEGER,
    "fournisseurId" INTEGER,
    "immobilisationId" INTEGER,
    "societeId" INTEGER,
    "creePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProvisionDepreciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementProvision" (
    "id" SERIAL NOT NULL,
    "provisionId" INTEGER NOT NULL,
    "type" "TypeMouvementProvision" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ecritureId" INTEGER,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementProvision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegularisationAvance" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" "TypeRegularisation" NOT NULL,
    "compteChargeOuProduitId" INTEGER NOT NULL,
    "compteRegularisationId" INTEGER NOT NULL,
    "montantTotal" DECIMAL(65,30) NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "ecritureConstatationId" INTEGER,
    "statut" "StatutRegularisation" NOT NULL DEFAULT 'ACTIVE',
    "societeId" INTEGER,
    "creePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegularisationAvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcheanceRegularisation" (
    "id" SERIAL NOT NULL,
    "regularisationId" INTEGER NOT NULL,
    "periode" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "ecritureId" INTEGER,
    "comptabilise" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcheanceRegularisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProvisionDepreciation_statut_idx" ON "ProvisionDepreciation"("statut");

-- CreateIndex
CREATE INDEX "ProvisionDepreciation_type_idx" ON "ProvisionDepreciation"("type");

-- CreateIndex
CREATE INDEX "MouvementProvision_provisionId_idx" ON "MouvementProvision"("provisionId");

-- CreateIndex
CREATE INDEX "RegularisationAvance_statut_idx" ON "RegularisationAvance"("statut");

-- CreateIndex
CREATE INDEX "RegularisationAvance_type_idx" ON "RegularisationAvance"("type");

-- CreateIndex
CREATE UNIQUE INDEX "EcheanceRegularisation_regularisationId_periode_key" ON "EcheanceRegularisation"("regularisationId", "periode");

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_compteProvisionId_fkey" FOREIGN KEY ("compteProvisionId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_compteDotationId_fkey" FOREIGN KEY ("compteDotationId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_compteRepriseId_fkey" FOREIGN KEY ("compteRepriseId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "Immobilisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionDepreciation" ADD CONSTRAINT "ProvisionDepreciation_creePar_fkey" FOREIGN KEY ("creePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementProvision" ADD CONSTRAINT "MouvementProvision_provisionId_fkey" FOREIGN KEY ("provisionId") REFERENCES "ProvisionDepreciation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementProvision" ADD CONSTRAINT "MouvementProvision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularisationAvance" ADD CONSTRAINT "RegularisationAvance_compteChargeOuProduitId_fkey" FOREIGN KEY ("compteChargeOuProduitId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularisationAvance" ADD CONSTRAINT "RegularisationAvance_compteRegularisationId_fkey" FOREIGN KEY ("compteRegularisationId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularisationAvance" ADD CONSTRAINT "RegularisationAvance_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularisationAvance" ADD CONSTRAINT "RegularisationAvance_creePar_fkey" FOREIGN KEY ("creePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcheanceRegularisation" ADD CONSTRAINT "EcheanceRegularisation_regularisationId_fkey" FOREIGN KEY ("regularisationId") REFERENCES "RegularisationAvance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
