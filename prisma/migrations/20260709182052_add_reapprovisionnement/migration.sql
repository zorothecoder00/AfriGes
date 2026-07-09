-- AlterTable
ALTER TABLE "StockSite" ADD COLUMN     "allee" TEXT,
ADD COLUMN     "disponible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "etagere" TEXT,
ADD COLUMN     "rayon" TEXT,
ADD COLUMN     "seuilCritique" INTEGER,
ADD COLUMN     "stockMax" INTEGER,
ADD COLUMN     "stockMin" INTEGER;

-- CreateIndex
CREATE INDEX "StockSite_produitId_idx" ON "StockSite"("produitId");
