-- CreateEnum
CREATE TYPE "TypeReclamation" AS ENUM ('PRODUIT_DEFECTUEUX', 'LIVRAISON_NON_CONFORME', 'ERREUR_FACTURATION', 'RETARD_LIVRAISON', 'QUALITE_SERVICE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutReclamation" AS ENUM ('ENREGISTREE', 'EN_TRAITEMENT', 'RESOLUE', 'CLOTUREE', 'REJETEE');

-- CreateEnum
CREATE TYPE "TypeActionReclamation" AS ENUM ('PRISE_EN_CHARGE', 'INVESTIGATION', 'RETOUR_ORGANISE', 'REMPLACEMENT_ORGANISE', 'AVOIR_EMIS', 'DECISION', 'REJET', 'CLOTURE', 'NOTE_INTERNE');

-- CreateEnum
CREATE TYPE "StatutRetourMarchandise" AS ENUM ('DECLARE', 'RECEPTIONNE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "StatutRemplacementProduit" AS ENUM ('DEMANDE', 'APPROUVE', 'LIVRE', 'REJETE');

-- CreateEnum
CREATE TYPE "TypeIncidentCommercial" AS ENUM ('LIVRAISON', 'PRODUIT', 'COMPORTEMENT_CLIENT', 'COMPORTEMENT_AGENT', 'AUTRE');

-- AlterEnum
ALTER TYPE "TypeSortieStock" ADD VALUE 'REMPLACEMENT_CLIENT';

-- AlterTable
ALTER TABLE "AvoirClient" ADD COLUMN     "reclamationId" INTEGER;

-- CreateTable
CREATE TABLE "ReclamationClient" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "sourceReference" TEXT,
    "type" "TypeReclamation" NOT NULL,
    "objet" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutReclamation" NOT NULL DEFAULT 'ENREGISTREE',
    "priorite" "PrioriteNotification" NOT NULL DEFAULT 'NORMAL',
    "creeParId" INTEGER NOT NULL,
    "assigneAId" INTEGER,
    "motifRejet" TEXT,
    "resumeCloture" TEXT,
    "clotureParId" INTEGER,
    "clotureLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReclamationClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneReclamation" (
    "id" SERIAL NOT NULL,
    "reclamationId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "motif" TEXT,

    CONSTRAINT "LigneReclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionReclamation" (
    "id" SERIAL NOT NULL,
    "reclamationId" INTEGER NOT NULL,
    "type" "TypeActionReclamation" NOT NULL,
    "description" TEXT,
    "auteurId" INTEGER NOT NULL,
    "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionReclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetourMarchandiseClient" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "reclamationId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "statut" "StatutRetourMarchandise" NOT NULL DEFAULT 'DECLARE',
    "magasinierId" INTEGER,
    "dateReception" TIMESTAMP(3),
    "motifRejet" TEXT,
    "mouvementStockId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetourMarchandiseClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneRetourMarchandise" (
    "id" SERIAL NOT NULL,
    "retourId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "etatProduit" TEXT,

    CONSTRAINT "LigneRetourMarchandise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemplacementProduit" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "reclamationId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "produitOrigineId" INTEGER NOT NULL,
    "produitRemplacementId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "statut" "StatutRemplacementProduit" NOT NULL DEFAULT 'DEMANDE',
    "magasinierId" INTEGER,
    "dateLivraison" TIMESTAMP(3),
    "motifRejet" TEXT,
    "mouvementSortieId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemplacementProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentCommercial" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "reclamationId" INTEGER,
    "dateIncident" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT NOT NULL,
    "type" "TypeIncidentCommercial" NOT NULL DEFAULT 'AUTRE',
    "description" TEXT NOT NULL,
    "personnesImpliquees" TEXT,
    "actionsCorrectives" TEXT,
    "statut" "StatutIncident" NOT NULL DEFAULT 'OUVERT',
    "declareParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentCommercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReclamationClient_numero_key" ON "ReclamationClient"("numero");

-- CreateIndex
CREATE INDEX "ReclamationClient_clientId_idx" ON "ReclamationClient"("clientId");

-- CreateIndex
CREATE INDEX "ReclamationClient_statut_idx" ON "ReclamationClient"("statut");

-- CreateIndex
CREATE INDEX "ReclamationClient_pointDeVenteId_idx" ON "ReclamationClient"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "LigneReclamation_reclamationId_idx" ON "LigneReclamation"("reclamationId");

-- CreateIndex
CREATE INDEX "ActionReclamation_reclamationId_idx" ON "ActionReclamation"("reclamationId");

-- CreateIndex
CREATE UNIQUE INDEX "RetourMarchandiseClient_numero_key" ON "RetourMarchandiseClient"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "RetourMarchandiseClient_mouvementStockId_key" ON "RetourMarchandiseClient"("mouvementStockId");

-- CreateIndex
CREATE INDEX "RetourMarchandiseClient_reclamationId_idx" ON "RetourMarchandiseClient"("reclamationId");

-- CreateIndex
CREATE INDEX "RetourMarchandiseClient_statut_idx" ON "RetourMarchandiseClient"("statut");

-- CreateIndex
CREATE INDEX "RetourMarchandiseClient_pointDeVenteId_idx" ON "RetourMarchandiseClient"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "LigneRetourMarchandise_retourId_idx" ON "LigneRetourMarchandise"("retourId");

-- CreateIndex
CREATE UNIQUE INDEX "RemplacementProduit_numero_key" ON "RemplacementProduit"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "RemplacementProduit_mouvementSortieId_key" ON "RemplacementProduit"("mouvementSortieId");

-- CreateIndex
CREATE INDEX "RemplacementProduit_reclamationId_idx" ON "RemplacementProduit"("reclamationId");

-- CreateIndex
CREATE INDEX "RemplacementProduit_statut_idx" ON "RemplacementProduit"("statut");

-- CreateIndex
CREATE INDEX "RemplacementProduit_pointDeVenteId_idx" ON "RemplacementProduit"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentCommercial_numero_key" ON "IncidentCommercial"("numero");

-- CreateIndex
CREATE INDEX "IncidentCommercial_statut_idx" ON "IncidentCommercial"("statut");

-- CreateIndex
CREATE INDEX "IncidentCommercial_reclamationId_idx" ON "IncidentCommercial"("reclamationId");

-- AddForeignKey
ALTER TABLE "AvoirClient" ADD CONSTRAINT "AvoirClient_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "ReclamationClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclamationClient" ADD CONSTRAINT "ReclamationClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclamationClient" ADD CONSTRAINT "ReclamationClient_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclamationClient" ADD CONSTRAINT "ReclamationClient_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReclamationClient" ADD CONSTRAINT "ReclamationClient_assigneAId_fkey" FOREIGN KEY ("assigneAId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReclamation" ADD CONSTRAINT "LigneReclamation_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "ReclamationClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReclamation" ADD CONSTRAINT "LigneReclamation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionReclamation" ADD CONSTRAINT "ActionReclamation_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "ReclamationClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionReclamation" ADD CONSTRAINT "ActionReclamation_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetourMarchandiseClient" ADD CONSTRAINT "RetourMarchandiseClient_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "ReclamationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetourMarchandiseClient" ADD CONSTRAINT "RetourMarchandiseClient_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetourMarchandiseClient" ADD CONSTRAINT "RetourMarchandiseClient_magasinierId_fkey" FOREIGN KEY ("magasinierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetourMarchandiseClient" ADD CONSTRAINT "RetourMarchandiseClient_mouvementStockId_fkey" FOREIGN KEY ("mouvementStockId") REFERENCES "MouvementStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRetourMarchandise" ADD CONSTRAINT "LigneRetourMarchandise_retourId_fkey" FOREIGN KEY ("retourId") REFERENCES "RetourMarchandiseClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRetourMarchandise" ADD CONSTRAINT "LigneRetourMarchandise_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemplacementProduit" ADD CONSTRAINT "RemplacementProduit_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "ReclamationClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemplacementProduit" ADD CONSTRAINT "RemplacementProduit_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemplacementProduit" ADD CONSTRAINT "RemplacementProduit_produitOrigineId_fkey" FOREIGN KEY ("produitOrigineId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemplacementProduit" ADD CONSTRAINT "RemplacementProduit_produitRemplacementId_fkey" FOREIGN KEY ("produitRemplacementId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemplacementProduit" ADD CONSTRAINT "RemplacementProduit_magasinierId_fkey" FOREIGN KEY ("magasinierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemplacementProduit" ADD CONSTRAINT "RemplacementProduit_mouvementSortieId_fkey" FOREIGN KEY ("mouvementSortieId") REFERENCES "MouvementStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCommercial" ADD CONSTRAINT "IncidentCommercial_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "ReclamationClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCommercial" ADD CONSTRAINT "IncidentCommercial_declareParId_fkey" FOREIGN KEY ("declareParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
