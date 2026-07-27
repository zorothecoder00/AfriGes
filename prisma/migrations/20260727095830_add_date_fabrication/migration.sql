-- AlterTable
ALTER TABLE "ContratFournisseur" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "LigneReceptionAppro" ADD COLUMN     "dateFabrication" TIMESTAMP(3),
ADD COLUMN     "quantiteRefusee" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "LotProduit" ADD COLUMN     "dateFabrication" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "unitesParPalette" INTEGER;

-- AlterTable
ALTER TABLE "StockSite" ADD COLUMN     "quantiteBloquee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantiteConsignee" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "_ProduitFournisseursSecondaires" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProduitFournisseursSecondaires_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProduitFournisseursSecondaires_B_index" ON "_ProduitFournisseursSecondaires"("B");

-- AddForeignKey
ALTER TABLE "_ProduitFournisseursSecondaires" ADD CONSTRAINT "_ProduitFournisseursSecondaires_A_fkey" FOREIGN KEY ("A") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProduitFournisseursSecondaires" ADD CONSTRAINT "_ProduitFournisseursSecondaires_B_fkey" FOREIGN KEY ("B") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
