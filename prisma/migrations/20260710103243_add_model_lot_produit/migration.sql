-- CreateEnum
CREATE TYPE "StatutLot" AS ENUM ('ACTIF', 'EPUISE', 'PERIME', 'RETIRE');

-- CreateEnum
CREATE TYPE "TypeMouvementLot" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT', 'PEREMPTION', 'RETRAIT');

-- CreateTable
CREATE TABLE "LotProduit" (
    "id" SERIAL NOT NULL,
    "numeroLot" TEXT NOT NULL,
    "produitId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "quantiteInitiale" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "dlc" TIMESTAMP(3),
    "dluo" TIMESTAMP(3),
    "dateReception" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prixAchat" DECIMAL(65,30),
    "statut" "StatutLot" NOT NULL DEFAULT 'ACTIF',
    "fournisseurId" INTEGER,
    "receptionApproId" INTEGER,
    "notes" TEXT,
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementLot" (
    "id" SERIAL NOT NULL,
    "lotId" INTEGER NOT NULL,
    "type" "TypeMouvementLot" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "motif" TEXT,
    "operateurId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LotProduit_produitId_pointDeVenteId_statut_idx" ON "LotProduit"("produitId", "pointDeVenteId", "statut");

-- CreateIndex
CREATE INDEX "LotProduit_dlc_idx" ON "LotProduit"("dlc");

-- CreateIndex
CREATE INDEX "LotProduit_statut_idx" ON "LotProduit"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "LotProduit_produitId_pointDeVenteId_numeroLot_key" ON "LotProduit"("produitId", "pointDeVenteId", "numeroLot");

-- CreateIndex
CREATE INDEX "MouvementLot_lotId_idx" ON "MouvementLot"("lotId");

-- CreateIndex
CREATE INDEX "MouvementLot_type_idx" ON "MouvementLot"("type");

-- AddForeignKey
ALTER TABLE "LotProduit" ADD CONSTRAINT "LotProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotProduit" ADD CONSTRAINT "LotProduit_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotProduit" ADD CONSTRAINT "LotProduit_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotProduit" ADD CONSTRAINT "LotProduit_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementLot" ADD CONSTRAINT "MouvementLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LotProduit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementLot" ADD CONSTRAINT "MouvementLot_operateurId_fkey" FOREIGN KEY ("operateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
