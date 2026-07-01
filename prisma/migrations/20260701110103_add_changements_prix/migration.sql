-- CreateEnum
CREATE TYPE "TypeChangementPrix" AS ENUM ('INITIAL', 'ACHAT', 'VENTE', 'LES_DEUX');

-- CreateTable
CREATE TABLE "HistoriquePrixProduit" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "prixAchat" DECIMAL(65,30),
    "prixVente" DECIMAL(65,30) NOT NULL,
    "marge" DECIMAL(65,30),
    "type" "TypeChangementPrix" NOT NULL,
    "source" TEXT,
    "motif" TEXT,
    "receptionApproId" INTEGER,
    "dateEffet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoriquePrixProduit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoriquePrixProduit_produitId_dateEffet_idx" ON "HistoriquePrixProduit"("produitId", "dateEffet");

-- CreateIndex
CREATE INDEX "HistoriquePrixProduit_dateEffet_idx" ON "HistoriquePrixProduit"("dateEffet");

-- AddForeignKey
ALTER TABLE "HistoriquePrixProduit" ADD CONSTRAINT "HistoriquePrixProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriquePrixProduit" ADD CONSTRAINT "HistoriquePrixProduit_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
