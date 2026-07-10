-- CreateEnum
CREATE TYPE "ModeStockVue" AS ENUM ('EXACT', 'PALIER', 'AUCUN');

-- CreateTable
CREATE TABLE "VueCatalogue" (
    "id" SERIAL NOT NULL,
    "cle" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "champsVisibles" TEXT[],
    "modeStock" "ModeStockVue" NOT NULL DEFAULT 'EXACT',
    "filtres" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VueCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VueCatalogue_cle_key" ON "VueCatalogue"("cle");
