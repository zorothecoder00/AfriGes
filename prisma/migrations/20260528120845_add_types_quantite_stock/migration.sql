-- AlterTable
ALTER TABLE "StockSite" ADD COLUMN     "quantiteEnTransit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantiteEndommagee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantiteReservee" INTEGER NOT NULL DEFAULT 0;
