/*
  Warnings:

  - You are about to drop the column `stock` on the `Produit` table. All the data in the column will be lost.
  - You are about to drop the `BonSortie` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LigneBonSortie` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Livraison` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LivraisonLigne` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[reference]` on the table `Produit` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TypePointDeVente" AS ENUM ('POINT_DE_VENTE', 'DEPOT_CENTRAL');

-- CreateEnum
CREATE TYPE "TypeEntreeStock" AS ENUM ('RECEPTION_FOURNISSEUR', 'RECEPTION_INTERNE', 'TRANSFERT_ENTRANT', 'AJUSTEMENT_POSITIF', 'RETOUR_CLIENT');

-- CreateEnum
CREATE TYPE "TypeSortieStock" AS ENUM ('VENTE_DIRECTE', 'LIVRAISON_PACK', 'LIVRAISON_CLIENT', 'RETOUR_FOURNISSEUR', 'CONSOMMATION_INTERNE', 'TRANSFERT_SORTANT', 'AJUSTEMENT_NEGATIF', 'PERTE', 'CASSE', 'DON');

-- CreateEnum
CREATE TYPE "StatutTransfertStock" AS ENUM ('EN_COURS', 'EXPEDIE', 'RECU', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeReceptionAppro" AS ENUM ('FOURNISSEUR', 'INTERNE');

-- CreateEnum
CREATE TYPE "StatutReceptionAppro" AS ENUM ('BROUILLON', 'EN_COURS', 'RECU', 'VALIDE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutInventaire" AS ENUM ('EN_COURS', 'VALIDE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutCommandeInterne" AS ENUM ('BROUILLON', 'SOUMISE', 'EN_COURS', 'COMPLETE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutVenteDirecte" AS ENUM ('BROUILLON', 'CONFIRMEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ModePaiementVente" AS ENUM ('ESPECES', 'VIREMENT', 'CHEQUE', 'MOBILE_MONEY', 'WALLET', 'CREDIT');

-- CreateEnum
CREATE TYPE "StatutVisiteControle" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "NiveauAlerteControle" AS ENUM ('INFO', 'ATTENTION', 'CRITIQUE');

-- AlterEnum
ALTER TYPE "ModePaiement" ADD VALUE 'MOBILE_MONEY';

-- AlterEnum
ALTER TYPE "RoleGestionnaire" ADD VALUE 'CHEF_AGENCE';

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'VENTE';

-- AlterEnum
ALTER TYPE "TypeFacture" ADD VALUE 'VENTE_DIRECTE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypePaiement" ADD VALUE 'ESPECES';
ALTER TYPE "TypePaiement" ADD VALUE 'VIREMENT';
ALTER TYPE "TypePaiement" ADD VALUE 'CHEQUE';
ALTER TYPE "TypePaiement" ADD VALUE 'MOBILE_MONEY';

-- DropForeignKey
ALTER TABLE "BonSortie" DROP CONSTRAINT "BonSortie_creePar_fkey";

-- DropForeignKey
ALTER TABLE "BonSortie" DROP CONSTRAINT "BonSortie_validePar_fkey";

-- DropForeignKey
ALTER TABLE "LigneBonSortie" DROP CONSTRAINT "LigneBonSortie_bonSortieId_fkey";

-- DropForeignKey
ALTER TABLE "LigneBonSortie" DROP CONSTRAINT "LigneBonSortie_produitId_fkey";

-- DropForeignKey
ALTER TABLE "LivraisonLigne" DROP CONSTRAINT "LivraisonLigne_livraisonId_fkey";

-- DropForeignKey
ALTER TABLE "LivraisonLigne" DROP CONSTRAINT "LivraisonLigne_produitId_fkey";

-- AlterTable
ALTER TABLE "AnomalieStock" ADD COLUMN     "pointDeVenteId" INTEGER;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "pointDeVenteId" INTEGER;

-- AlterTable
ALTER TABLE "ClotureCaisse" ADD COLUMN     "pointDeVenteId" INTEGER;

-- AlterTable
ALTER TABLE "MouvementStock" ADD COLUMN     "operateurId" INTEGER,
ADD COLUMN     "pointDeVenteId" INTEGER,
ADD COLUMN     "receptionApproId" INTEGER,
ADD COLUMN     "souscriptionId" INTEGER,
ADD COLUMN     "transfertStockId" INTEGER,
ADD COLUMN     "typeEntree" "TypeEntreeStock",
ADD COLUMN     "typeSortie" "TypeSortieStock",
ADD COLUMN     "venteDirecteId" INTEGER;

-- AlterTable
ALTER TABLE "Produit" DROP COLUMN "stock",
ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "categorie" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "unite" TEXT;

-- AlterTable
ALTER TABLE "SessionCaisse" ADD COLUMN     "pointDeVenteId" INTEGER;

-- DropTable
DROP TABLE "BonSortie";

-- DropTable
DROP TABLE "LigneBonSortie";

-- DropTable
DROP TABLE "Livraison";

-- DropTable
DROP TABLE "LivraisonLigne";

-- DropEnum
DROP TYPE "StatutBonSortie";

-- DropEnum
DROP TYPE "StatutLivraison";

-- DropEnum
DROP TYPE "TypeBonSortie";

-- DropEnum
DROP TYPE "TypeLivraison";

-- CreateTable
CREATE TABLE "PointDeVente" (
    "id" SERIAL NOT NULL,
    "type" "TypePointDeVente" NOT NULL DEFAULT 'POINT_DE_VENTE',
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "rpvId" INTEGER,
    "chefAgenceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointDeVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GestionnaireAffectation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "GestionnaireAffectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fournisseur" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "adresse" TEXT,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockSite" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "alerteStock" INTEGER,

    CONSTRAINT "StockSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceptionApprovisionnement" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TypeReceptionAppro" NOT NULL,
    "statut" "StatutReceptionAppro" NOT NULL DEFAULT 'BROUILLON',
    "pointDeVenteId" INTEGER NOT NULL,
    "fournisseurId" INTEGER,
    "fournisseurNom" TEXT,
    "origineId" INTEGER,
    "origineNom" TEXT,
    "datePrevisionnelle" TIMESTAMP(3) NOT NULL,
    "dateReception" TIMESTAMP(3),
    "controlQualite" BOOLEAN NOT NULL DEFAULT false,
    "notesQualite" TEXT,
    "notes" TEXT,
    "receptionneParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceptionApprovisionnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneReceptionAppro" (
    "id" SERIAL NOT NULL,
    "receptionId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantiteAttendue" INTEGER NOT NULL,
    "quantiteRecue" INTEGER,
    "prixUnitaire" DECIMAL(65,30),
    "etatQualite" TEXT,
    "notes" TEXT,

    CONSTRAINT "LigneReceptionAppro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransfertStock" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutTransfertStock" NOT NULL DEFAULT 'EN_COURS',
    "origineId" INTEGER NOT NULL,
    "destinationId" INTEGER NOT NULL,
    "creeParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "dateExpedition" TIMESTAMP(3),
    "dateReception" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransfertStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneTransfertStock" (
    "id" SERIAL NOT NULL,
    "transfertId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnit" DECIMAL(65,30),

    CONSTRAINT "LigneTransfertStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventaireSite" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutInventaire" NOT NULL DEFAULT 'EN_COURS',
    "pointDeVenteId" INTEGER NOT NULL,
    "dateInventaire" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "realiseParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventaireSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneInventaireSite" (
    "id" SERIAL NOT NULL,
    "inventaireId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantiteSysteme" INTEGER NOT NULL,
    "quantiteConstatee" INTEGER NOT NULL,
    "ecart" INTEGER NOT NULL,

    CONSTRAINT "LigneInventaireSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeInterne" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutCommandeInterne" NOT NULL DEFAULT 'BROUILLON',
    "demandeurId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandeInterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneCommandeInterne" (
    "id" SERIAL NOT NULL,
    "commandeId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantiteDemandee" INTEGER NOT NULL,
    "quantiteValidee" INTEGER,

    CONSTRAINT "LigneCommandeInterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaissePDV" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "rpvId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "sessionCaisseId" INTEGER,
    "fondsCaisse" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutSessionCaisse" NOT NULL DEFAULT 'OUVERTE',
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFermeture" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaissePDV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationCaissePDV" (
    "id" SERIAL NOT NULL,
    "caissePDVId" INTEGER NOT NULL,
    "type" "TypeOperationCaisse" NOT NULL,
    "mode" "ModePaiement",
    "categorie" "CategorieDecaissement",
    "montant" DECIMAL(65,30) NOT NULL,
    "motif" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "operateurNom" TEXT NOT NULL,
    "operateurId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationCaissePDV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenteDirecte" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutVenteDirecte" NOT NULL DEFAULT 'BROUILLON',
    "pointDeVenteId" INTEGER NOT NULL,
    "vendeurId" INTEGER NOT NULL,
    "modePaiement" "ModePaiementVente" NOT NULL,
    "montantTotal" DECIMAL(65,30) NOT NULL,
    "montantPaye" DECIMAL(65,30) NOT NULL,
    "monnaieRendue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "clientId" INTEGER,
    "clientNom" TEXT,
    "clientTelephone" TEXT,
    "caissePDVId" INTEGER,
    "sessionCaisseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenteDirecte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneVenteDirecte" (
    "id" SERIAL NOT NULL,
    "venteId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LigneVenteDirecte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisiteControle" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutVisiteControle" NOT NULL DEFAULT 'PLANIFIEE',
    "controleurId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "datePlanifiee" TIMESTAMP(3) NOT NULL,
    "dateRealise" TIMESTAMP(3),
    "objectif" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisiteControle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportControle" (
    "id" SERIAL NOT NULL,
    "visiteId" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "recommandations" TEXT,
    "destinataires" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapportControle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlerteRapport" (
    "id" SERIAL NOT NULL,
    "rapportId" INTEGER NOT NULL,
    "niveau" "NiveauAlerteControle" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlerteRapport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointDeVente_code_key" ON "PointDeVente"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PointDeVente_rpvId_key" ON "PointDeVente"("rpvId");

-- CreateIndex
CREATE INDEX "PointDeVente_type_idx" ON "PointDeVente"("type");

-- CreateIndex
CREATE INDEX "GestionnaireAffectation_userId_idx" ON "GestionnaireAffectation"("userId");

-- CreateIndex
CREATE INDEX "GestionnaireAffectation_pointDeVenteId_idx" ON "GestionnaireAffectation"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "GestionnaireAffectation_userId_pointDeVenteId_key" ON "GestionnaireAffectation"("userId", "pointDeVenteId");

-- CreateIndex
CREATE INDEX "StockSite_pointDeVenteId_idx" ON "StockSite"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "StockSite_produitId_pointDeVenteId_key" ON "StockSite"("produitId", "pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceptionApprovisionnement_reference_key" ON "ReceptionApprovisionnement"("reference");

-- CreateIndex
CREATE INDEX "ReceptionApprovisionnement_statut_idx" ON "ReceptionApprovisionnement"("statut");

-- CreateIndex
CREATE INDEX "ReceptionApprovisionnement_type_idx" ON "ReceptionApprovisionnement"("type");

-- CreateIndex
CREATE INDEX "ReceptionApprovisionnement_pointDeVenteId_idx" ON "ReceptionApprovisionnement"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "TransfertStock_reference_key" ON "TransfertStock"("reference");

-- CreateIndex
CREATE INDEX "TransfertStock_statut_idx" ON "TransfertStock"("statut");

-- CreateIndex
CREATE INDEX "TransfertStock_origineId_idx" ON "TransfertStock"("origineId");

-- CreateIndex
CREATE INDEX "TransfertStock_destinationId_idx" ON "TransfertStock"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventaireSite_reference_key" ON "InventaireSite"("reference");

-- CreateIndex
CREATE INDEX "InventaireSite_statut_idx" ON "InventaireSite"("statut");

-- CreateIndex
CREATE INDEX "InventaireSite_pointDeVenteId_idx" ON "InventaireSite"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandeInterne_reference_key" ON "CommandeInterne"("reference");

-- CreateIndex
CREATE INDEX "CommandeInterne_statut_idx" ON "CommandeInterne"("statut");

-- CreateIndex
CREATE INDEX "CommandeInterne_pointDeVenteId_idx" ON "CommandeInterne"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationCaissePDV_reference_key" ON "OperationCaissePDV"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "VenteDirecte_reference_key" ON "VenteDirecte"("reference");

-- CreateIndex
CREATE INDEX "VenteDirecte_statut_idx" ON "VenteDirecte"("statut");

-- CreateIndex
CREATE INDEX "VenteDirecte_pointDeVenteId_idx" ON "VenteDirecte"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "VenteDirecte_vendeurId_idx" ON "VenteDirecte"("vendeurId");

-- CreateIndex
CREATE UNIQUE INDEX "VisiteControle_reference_key" ON "VisiteControle"("reference");

-- CreateIndex
CREATE INDEX "VisiteControle_statut_idx" ON "VisiteControle"("statut");

-- CreateIndex
CREATE INDEX "VisiteControle_controleurId_idx" ON "VisiteControle"("controleurId");

-- CreateIndex
CREATE INDEX "MouvementStock_produitId_idx" ON "MouvementStock"("produitId");

-- CreateIndex
CREATE INDEX "MouvementStock_pointDeVenteId_idx" ON "MouvementStock"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "MouvementStock_type_idx" ON "MouvementStock"("type");

-- CreateIndex
CREATE INDEX "MouvementStock_dateMouvement_idx" ON "MouvementStock"("dateMouvement");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_reference_key" ON "Produit"("reference");

-- AddForeignKey
ALTER TABLE "PointDeVente" ADD CONSTRAINT "PointDeVente_rpvId_fkey" FOREIGN KEY ("rpvId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointDeVente" ADD CONSTRAINT "PointDeVente_chefAgenceId_fkey" FOREIGN KEY ("chefAgenceId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GestionnaireAffectation" ADD CONSTRAINT "GestionnaireAffectation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GestionnaireAffectation" ADD CONSTRAINT "GestionnaireAffectation_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSite" ADD CONSTRAINT "StockSite_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSite" ADD CONSTRAINT "StockSite_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionApprovisionnement" ADD CONSTRAINT "ReceptionApprovisionnement_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionApprovisionnement" ADD CONSTRAINT "ReceptionApprovisionnement_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionApprovisionnement" ADD CONSTRAINT "ReceptionApprovisionnement_receptionneParId_fkey" FOREIGN KEY ("receptionneParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionApprovisionnement" ADD CONSTRAINT "ReceptionApprovisionnement_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReceptionAppro" ADD CONSTRAINT "LigneReceptionAppro_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "ReceptionApprovisionnement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReceptionAppro" ADD CONSTRAINT "LigneReceptionAppro_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertStock" ADD CONSTRAINT "TransfertStock_origineId_fkey" FOREIGN KEY ("origineId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertStock" ADD CONSTRAINT "TransfertStock_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertStock" ADD CONSTRAINT "TransfertStock_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertStock" ADD CONSTRAINT "TransfertStock_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneTransfertStock" ADD CONSTRAINT "LigneTransfertStock_transfertId_fkey" FOREIGN KEY ("transfertId") REFERENCES "TransfertStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneTransfertStock" ADD CONSTRAINT "LigneTransfertStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventaireSite" ADD CONSTRAINT "InventaireSite_realiseParId_fkey" FOREIGN KEY ("realiseParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventaireSite" ADD CONSTRAINT "InventaireSite_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventaireSite" ADD CONSTRAINT "InventaireSite_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneInventaireSite" ADD CONSTRAINT "LigneInventaireSite_inventaireId_fkey" FOREIGN KEY ("inventaireId") REFERENCES "InventaireSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneInventaireSite" ADD CONSTRAINT "LigneInventaireSite_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeInterne" ADD CONSTRAINT "CommandeInterne_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeInterne" ADD CONSTRAINT "CommandeInterne_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeInterne" ADD CONSTRAINT "LigneCommandeInterne_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeInterne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommandeInterne" ADD CONSTRAINT "LigneCommandeInterne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCaisse" ADD CONSTRAINT "SessionCaisse_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaissePDV" ADD CONSTRAINT "CaissePDV_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaissePDV" ADD CONSTRAINT "CaissePDV_sessionCaisseId_fkey" FOREIGN KEY ("sessionCaisseId") REFERENCES "SessionCaisse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationCaissePDV" ADD CONSTRAINT "OperationCaissePDV_caissePDVId_fkey" FOREIGN KEY ("caissePDVId") REFERENCES "CaissePDV"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClotureCaisse" ADD CONSTRAINT "ClotureCaisse_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_caissePDVId_fkey" FOREIGN KEY ("caissePDVId") REFERENCES "CaissePDV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVenteDirecte" ADD CONSTRAINT "LigneVenteDirecte_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "VenteDirecte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneVenteDirecte" ADD CONSTRAINT "LigneVenteDirecte_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisiteControle" ADD CONSTRAINT "VisiteControle_controleurId_fkey" FOREIGN KEY ("controleurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisiteControle" ADD CONSTRAINT "VisiteControle_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportControle" ADD CONSTRAINT "RapportControle_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "VisiteControle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlerteRapport" ADD CONSTRAINT "AlerteRapport_rapportId_fkey" FOREIGN KEY ("rapportId") REFERENCES "RapportControle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
