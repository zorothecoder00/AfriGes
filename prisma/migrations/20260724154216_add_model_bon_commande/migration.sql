-- CreateEnum
CREATE TYPE "StatutBonCommande" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StatutLivraisonPO" AS ENUM ('PREPARATION', 'EXPEDIEE', 'EN_TRANSIT', 'DOUANE', 'LIVREE', 'RECEPTIONNEE');

-- AlterTable
ALTER TABLE "ReceptionApprovisionnement" ADD COLUMN     "bonCommandeId" INTEGER;

-- CreateTable
CREATE TABLE "BonCommande" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutBonCommande" NOT NULL DEFAULT 'DRAFT',
    "statutLivraison" "StatutLivraisonPO",
    "fournisseurId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "demandeCotationId" INTEGER,
    "dateCommande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraisonPrevue" TIMESTAMP(3),
    "devise" TEXT DEFAULT 'XOF',
    "montantTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "approuveParId" INTEGER,
    "dateApprobation" TIMESTAMP(3),
    "envoyeParId" INTEGER,
    "dateEnvoi" TIMESTAMP(3),
    "signeParId" INTEGER,
    "dateSignature" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonCommande" (
    "id" SERIAL NOT NULL,
    "bonCommandeId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "quantiteRecue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneBonCommande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonCommande_reference_key" ON "BonCommande"("reference");

-- CreateIndex
CREATE INDEX "BonCommande_statut_idx" ON "BonCommande"("statut");

-- CreateIndex
CREATE INDEX "BonCommande_fournisseurId_idx" ON "BonCommande"("fournisseurId");

-- CreateIndex
CREATE INDEX "BonCommande_pointDeVenteId_idx" ON "BonCommande"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "LigneBonCommande_bonCommandeId_idx" ON "LigneBonCommande"("bonCommandeId");

-- AddForeignKey
ALTER TABLE "ReceptionApprovisionnement" ADD CONSTRAINT "ReceptionApprovisionnement_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_demandeCotationId_fkey" FOREIGN KEY ("demandeCotationId") REFERENCES "DemandeCotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_approuveParId_fkey" FOREIGN KEY ("approuveParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_envoyeParId_fkey" FOREIGN KEY ("envoyeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_signeParId_fkey" FOREIGN KEY ("signeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonCommande" ADD CONSTRAINT "LigneBonCommande_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonCommande" ADD CONSTRAINT "LigneBonCommande_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
