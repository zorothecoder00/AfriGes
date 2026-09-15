-- CreateEnum
CREATE TYPE "StatutBordereauRemise" AS ENUM ('SOUMIS', 'ECART_SIGNALE', 'VALIDE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "TypeClientCommande" AS ENUM ('PARTICULIER', 'REVENDEUR');

-- CreateEnum
CREATE TYPE "ModeReglementCommandeClient" AS ENUM ('COMPTANT', 'MOBILE_MONEY', 'CREDIT');

-- CreateEnum
CREATE TYPE "StatutCommandeClient" AS ENUM ('SOUMISE', 'EN_VALIDATION', 'VALIDEE', 'EN_PREPARATION', 'LIVREE', 'CLOTUREE', 'REJETEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeDepenseDecaissement" AS ENUM ('ACHAT_MARCHANDISES', 'FOURNITURES', 'PAIEMENT_FOURNISSEUR', 'AVANCE_CAISSE', 'FRAIS_FONCTIONNEMENT', 'TRANSPORT', 'AUTRES');

-- CreateEnum
CREATE TYPE "ModePaiementDecaissement" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT');

-- CreateEnum
CREATE TYPE "StatutDecaissement" AS ENUM ('SOUMISE', 'APPROUVEE', 'PAYEE', 'REJETEE');

-- AlterTable
ALTER TABLE "BonCommande" ADD COLUMN     "dateVisaCGT" TIMESTAMP(3),
ADD COLUMN     "visaCGTParId" INTEGER;

-- AlterTable
ALTER TABLE "BonSortie" ADD COLUMN     "commentaireEcart" TEXT,
ADD COLUMN     "dateValidation" TIMESTAMP(3),
ADD COLUMN     "dateVisa" TIMESTAMP(3),
ADD COLUMN     "montantTotal" DECIMAL(65,30),
ADD COLUMN     "viseParId" INTEGER;

-- AlterTable
ALTER TABLE "LigneBonSortie" ADD COLUMN     "quantiteDemandee" INTEGER;

-- CreateTable
CREATE TABLE "BordereauRemiseFonds" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutBordereauRemise" NOT NULL DEFAULT 'SOUMIS',
    "pointDeVenteId" INTEGER NOT NULL,
    "collecteurId" INTEGER NOT NULL,
    "cotisationsEspeces" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cotisationsMobileMoney" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "mobileMoneyReference" TEXT,
    "remboursements" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ventes" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "venteCarnet" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fraisLivraison" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantVirement" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "virementReference" TEXT,
    "totalEspecesAttendu" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBilletageCalcule" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ecartSoumission" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "motifEcartSoumission" TEXT,
    "tresorierId" INTEGER,
    "montantConfirmeTresorier" DECIMAL(65,30),
    "dateTraitementTresorier" TIMESTAMP(3),
    "ecartTresorier" DECIMAL(65,30),
    "motifEcartTresorier" TEXT,
    "visaCGTParId" INTEGER,
    "dateVisaCGT" TIMESTAMP(3),
    "depotBancaireReference" TEXT,
    "dateDepotBancaire" TIMESTAMP(3),
    "clotureParId" INTEGER,
    "dateCloture" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BordereauRemiseFonds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBilletageBRF" (
    "id" SERIAL NOT NULL,
    "bordereauId" INTEGER NOT NULL,
    "denomination" INTEGER NOT NULL,
    "nombre" INTEGER NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneBilletageBRF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeClient" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutCommandeClient" NOT NULL DEFAULT 'SOUMISE',
    "agentId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "typeClientCommande" "TypeClientCommande" NOT NULL DEFAULT 'PARTICULIER',
    "modeReglement" "ModeReglementCommandeClient" NOT NULL DEFAULT 'COMPTANT',
    "dateLivraisonSouhaitee" TIMESTAMP(3),
    "lieuLivraison" TEXT,
    "totalHT" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRemise" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTVA" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTTC" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "signatureClientNom" TEXT NOT NULL,
    "dateSignatureClient" TIMESTAMP(3) NOT NULL,
    "visaResponsableParId" INTEGER,
    "dateVisaResponsable" TIMESTAMP(3),
    "motifRejet" TEXT,
    "bonSortieId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandeClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommandeClient" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "remisePourcent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remiseMontant" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalLigne" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneCommandeClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FicheDecaissement" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutDecaissement" NOT NULL DEFAULT 'SOUMISE',
    "demandeurId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "beneficiaireNom" TEXT NOT NULL,
    "beneficiaireContact" TEXT,
    "fournisseurId" INTEGER,
    "motif" TEXT NOT NULL,
    "typeDepense" "TypeDepenseDecaissement" NOT NULL,
    "montantDemande" DECIMAL(65,30) NOT NULL,
    "montantApprouve" DECIMAL(65,30),
    "motifEcartMontant" TEXT,
    "modePaiement" "ModePaiementDecaissement",
    "referencePaiement" TEXT,
    "bonCommandeFournisseurId" INTEGER,
    "piecesJustificatives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approbateurN1Id" INTEGER,
    "dateApprobationN1" TIMESTAMP(3),
    "approbateurN2Id" INTEGER,
    "dateApprobationN2" TIMESTAMP(3),
    "executeParId" INTEGER,
    "dateExecution" TIMESTAMP(3),
    "beneficiaireConfirmationNom" TEXT,
    "beneficiaireConfirmationPiece" TEXT,
    "dateConfirmationBeneficiaire" TIMESTAMP(3),
    "motifRejet" TEXT,
    "ecritureId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FicheDecaissement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BordereauRemiseFonds_reference_key" ON "BordereauRemiseFonds"("reference");

-- CreateIndex
CREATE INDEX "BordereauRemiseFonds_statut_idx" ON "BordereauRemiseFonds"("statut");

-- CreateIndex
CREATE INDEX "BordereauRemiseFonds_pointDeVenteId_idx" ON "BordereauRemiseFonds"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "BordereauRemiseFonds_collecteurId_idx" ON "BordereauRemiseFonds"("collecteurId");

-- CreateIndex
CREATE INDEX "LigneBilletageBRF_bordereauId_idx" ON "LigneBilletageBRF"("bordereauId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandeClient_reference_key" ON "CommandeClient"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CommandeClient_bonSortieId_key" ON "CommandeClient"("bonSortieId");

-- CreateIndex
CREATE INDEX "CommandeClient_statut_idx" ON "CommandeClient"("statut");

-- CreateIndex
CREATE INDEX "CommandeClient_pointDeVenteId_idx" ON "CommandeClient"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "CommandeClient_agentId_idx" ON "CommandeClient"("agentId");

-- CreateIndex
CREATE INDEX "CommandeClient_clientId_idx" ON "CommandeClient"("clientId");

-- CreateIndex
CREATE INDEX "LigneCommandeClient_commandeId_idx" ON "LigneCommandeClient"("commandeId");

-- CreateIndex
CREATE UNIQUE INDEX "FicheDecaissement_reference_key" ON "FicheDecaissement"("reference");

-- CreateIndex
CREATE INDEX "FicheDecaissement_statut_idx" ON "FicheDecaissement"("statut");

-- CreateIndex
CREATE INDEX "FicheDecaissement_demandeurId_idx" ON "FicheDecaissement"("demandeurId");

-- CreateIndex
CREATE INDEX "FicheDecaissement_typeDepense_idx" ON "FicheDecaissement"("typeDepense");

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_visaCGTParId_fkey" FOREIGN KEY ("visaCGTParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonSortie" ADD CONSTRAINT "BonSortie_viseParId_fkey" FOREIGN KEY ("viseParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BordereauRemiseFonds" ADD CONSTRAINT "BordereauRemiseFonds_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BordereauRemiseFonds" ADD CONSTRAINT "BordereauRemiseFonds_collecteurId_fkey" FOREIGN KEY ("collecteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BordereauRemiseFonds" ADD CONSTRAINT "BordereauRemiseFonds_tresorierId_fkey" FOREIGN KEY ("tresorierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BordereauRemiseFonds" ADD CONSTRAINT "BordereauRemiseFonds_visaCGTParId_fkey" FOREIGN KEY ("visaCGTParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BordereauRemiseFonds" ADD CONSTRAINT "BordereauRemiseFonds_clotureParId_fkey" FOREIGN KEY ("clotureParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBilletageBRF" ADD CONSTRAINT "LigneBilletageBRF_bordereauId_fkey" FOREIGN KEY ("bordereauId") REFERENCES "BordereauRemiseFonds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeClient" ADD CONSTRAINT "CommandeClient_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeClient" ADD CONSTRAINT "CommandeClient_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeClient" ADD CONSTRAINT "CommandeClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeClient" ADD CONSTRAINT "CommandeClient_visaResponsableParId_fkey" FOREIGN KEY ("visaResponsableParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeClient" ADD CONSTRAINT "CommandeClient_bonSortieId_fkey" FOREIGN KEY ("bonSortieId") REFERENCES "BonSortie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeClient" ADD CONSTRAINT "LigneCommandeClient_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeClient" ADD CONSTRAINT "LigneCommandeClient_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_bonCommandeFournisseurId_fkey" FOREIGN KEY ("bonCommandeFournisseurId") REFERENCES "BonCommande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_approbateurN1Id_fkey" FOREIGN KEY ("approbateurN1Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_approbateurN2Id_fkey" FOREIGN KEY ("approbateurN2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_executeParId_fkey" FOREIGN KEY ("executeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
