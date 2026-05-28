-- CreateEnum
CREATE TYPE "StatutDemandeAjustement" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');

-- CreateTable
CREATE TABLE "DemandeAjustementStock" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "ancienneQuantite" INTEGER NOT NULL,
    "nouvelleQuantite" INTEGER NOT NULL,
    "justification" TEXT NOT NULL,
    "statut" "StatutDemandeAjustement" NOT NULL DEFAULT 'EN_ATTENTE',
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "demandeurId" INTEGER NOT NULL,
    "validateurId" INTEGER,
    "commentaireValidation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeAjustementStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeAjustementStock_statut_idx" ON "DemandeAjustementStock"("statut");

-- CreateIndex
CREATE INDEX "DemandeAjustementStock_produitId_idx" ON "DemandeAjustementStock"("produitId");

-- CreateIndex
CREATE INDEX "DemandeAjustementStock_pointDeVenteId_idx" ON "DemandeAjustementStock"("pointDeVenteId");

-- AddForeignKey
ALTER TABLE "DemandeAjustementStock" ADD CONSTRAINT "DemandeAjustementStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAjustementStock" ADD CONSTRAINT "DemandeAjustementStock_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAjustementStock" ADD CONSTRAINT "DemandeAjustementStock_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAjustementStock" ADD CONSTRAINT "DemandeAjustementStock_validateurId_fkey" FOREIGN KEY ("validateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
