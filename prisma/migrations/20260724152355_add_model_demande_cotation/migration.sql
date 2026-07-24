-- CreateEnum
CREATE TYPE "StatutRFQ" AS ENUM ('BROUILLON', 'ENVOYEE', 'REPONSES_RECUES', 'CLOTUREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutReponseRFQ" AS ENUM ('EN_ATTENTE', 'RECUE', 'RETENUE', 'REJETEE');

-- CreateTable
CREATE TABLE "DemandeCotation" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutRFQ" NOT NULL DEFAULT 'BROUILLON',
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "dateLimiteReponse" TIMESTAMP(3),
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "fournisseurRetenuId" INTEGER,
    "dateCloture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeCotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReponseRFQ" (
    "id" SERIAL NOT NULL,
    "demandeId" INTEGER NOT NULL,
    "fournisseurId" INTEGER NOT NULL,
    "statut" "StatutReponseRFQ" NOT NULL DEFAULT 'EN_ATTENTE',
    "emailEnvoyeA" TIMESTAMP(3),
    "prixUnitaire" DECIMAL(65,30),
    "delaiLivraisonJours" INTEGER,
    "notes" TEXT,
    "dateReponse" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReponseRFQ_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemandeCotation_reference_key" ON "DemandeCotation"("reference");

-- CreateIndex
CREATE INDEX "DemandeCotation_statut_idx" ON "DemandeCotation"("statut");

-- CreateIndex
CREATE INDEX "DemandeCotation_produitId_idx" ON "DemandeCotation"("produitId");

-- CreateIndex
CREATE INDEX "ReponseRFQ_fournisseurId_idx" ON "ReponseRFQ"("fournisseurId");

-- CreateIndex
CREATE UNIQUE INDEX "ReponseRFQ_demandeId_fournisseurId_key" ON "ReponseRFQ"("demandeId", "fournisseurId");

-- AddForeignKey
ALTER TABLE "DemandeCotation" ADD CONSTRAINT "DemandeCotation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeCotation" ADD CONSTRAINT "DemandeCotation_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeCotation" ADD CONSTRAINT "DemandeCotation_fournisseurRetenuId_fkey" FOREIGN KEY ("fournisseurRetenuId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReponseRFQ" ADD CONSTRAINT "ReponseRFQ_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandeCotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReponseRFQ" ADD CONSTRAINT "ReponseRFQ_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
