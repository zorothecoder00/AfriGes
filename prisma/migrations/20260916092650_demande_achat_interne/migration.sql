-- CreateEnum
CREATE TYPE "StatutDemandeAchat" AS ENUM ('SOUMISE', 'EN_VALIDATION', 'APPROUVEE', 'REJETEE', 'ANNULEE', 'CLOTUREE');

-- AlterTable
ALTER TABLE "DemandeCotation" ADD COLUMN     "demandeAchatLigneId" INTEGER;

-- CreateTable
CREATE TABLE "DemandeAchatInterne" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutDemandeAchat" NOT NULL DEFAULT 'SOUMISE',
    "demandeurId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER,
    "motif" TEXT NOT NULL,
    "notes" TEXT,
    "montantEstimatif" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "viseParId" INTEGER,
    "dateVisa" TIMESTAMP(3),
    "motifRejet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeAchatInterne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneDemandeAchatInterne" (
    "id" SERIAL NOT NULL,
    "demandeId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "justification" TEXT,

    CONSTRAINT "LigneDemandeAchatInterne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemandeAchatInterne_reference_key" ON "DemandeAchatInterne"("reference");

-- CreateIndex
CREATE INDEX "DemandeAchatInterne_statut_idx" ON "DemandeAchatInterne"("statut");

-- CreateIndex
CREATE INDEX "DemandeAchatInterne_demandeurId_idx" ON "DemandeAchatInterne"("demandeurId");

-- CreateIndex
CREATE INDEX "LigneDemandeAchatInterne_demandeId_idx" ON "LigneDemandeAchatInterne"("demandeId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandeCotation_demandeAchatLigneId_key" ON "DemandeCotation"("demandeAchatLigneId");

-- AddForeignKey
ALTER TABLE "DemandeAchatInterne" ADD CONSTRAINT "DemandeAchatInterne_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAchatInterne" ADD CONSTRAINT "DemandeAchatInterne_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAchatInterne" ADD CONSTRAINT "DemandeAchatInterne_viseParId_fkey" FOREIGN KEY ("viseParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDemandeAchatInterne" ADD CONSTRAINT "LigneDemandeAchatInterne_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandeAchatInterne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDemandeAchatInterne" ADD CONSTRAINT "LigneDemandeAchatInterne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeCotation" ADD CONSTRAINT "DemandeCotation_demandeAchatLigneId_fkey" FOREIGN KEY ("demandeAchatLigneId") REFERENCES "LigneDemandeAchatInterne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

