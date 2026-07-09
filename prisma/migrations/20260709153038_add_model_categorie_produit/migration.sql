/*
  Warnings:

  - A unique constraint covering the columns `[codeProduit]` on the table `Produit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codeBarre]` on the table `Produit` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatutProduit" AS ENUM ('ACTIF', 'EN_ATTENTE', 'SUSPENDU', 'MASQUE', 'ARCHIVE');

-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "categorieId" INTEGER,
ADD COLUMN     "codeBarre" TEXT,
ADD COLUMN     "codeProduit" TEXT,
ADD COLUMN     "conditionnement" TEXT,
ADD COLUMN     "couleur" TEXT,
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "familleId" INTEGER,
ADD COLUMN     "ficheTechniqueUrl" TEXT,
ADD COLUMN     "fournisseurPrincipalId" INTEGER,
ADD COLUMN     "imagePrincipaleUrl" TEXT,
ADD COLUMN     "imagesSecondaires" TEXT[],
ADD COLUMN     "marqueId" INTEGER,
ADD COLUMN     "nomCommercial" TEXT,
ADD COLUMN     "paysOrigine" TEXT,
ADD COLUMN     "poids" DECIMAL(65,30),
ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "saveur" TEXT,
ADD COLUMN     "sousCategorieId" INTEGER,
ADD COLUMN     "sousFamilleId" INTEGER,
ADD COLUMN     "statut" "StatutProduit" NOT NULL DEFAULT 'ACTIF',
ADD COLUMN     "uniteAchatId" INTEGER,
ADD COLUMN     "uniteVenteId" INTEGER,
ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "volume" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "FamilleProduit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilleProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SousFamilleProduit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "familleId" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SousFamilleProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorieProduit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorieProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SousCategorieProduit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "categorieId" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SousCategorieProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarqueProduit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "logoUrl" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarqueProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniteProduit" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "symbole" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniteProduit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilleProduit_nom_key" ON "FamilleProduit"("nom");

-- CreateIndex
CREATE INDEX "SousFamilleProduit_familleId_idx" ON "SousFamilleProduit"("familleId");

-- CreateIndex
CREATE UNIQUE INDEX "SousFamilleProduit_familleId_nom_key" ON "SousFamilleProduit"("familleId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "CategorieProduit_nom_key" ON "CategorieProduit"("nom");

-- CreateIndex
CREATE INDEX "SousCategorieProduit_categorieId_idx" ON "SousCategorieProduit"("categorieId");

-- CreateIndex
CREATE UNIQUE INDEX "SousCategorieProduit_categorieId_nom_key" ON "SousCategorieProduit"("categorieId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "MarqueProduit_nom_key" ON "MarqueProduit"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "UniteProduit_nom_key" ON "UniteProduit"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_codeProduit_key" ON "Produit"("codeProduit");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_codeBarre_key" ON "Produit"("codeBarre");

-- CreateIndex
CREATE INDEX "Produit_statut_idx" ON "Produit"("statut");

-- CreateIndex
CREATE INDEX "Produit_familleId_idx" ON "Produit"("familleId");

-- CreateIndex
CREATE INDEX "Produit_categorieId_idx" ON "Produit"("categorieId");

-- CreateIndex
CREATE INDEX "Produit_marqueId_idx" ON "Produit"("marqueId");

-- CreateIndex
CREATE INDEX "Produit_fournisseurPrincipalId_idx" ON "Produit"("fournisseurPrincipalId");

-- AddForeignKey
ALTER TABLE "SousFamilleProduit" ADD CONSTRAINT "SousFamilleProduit_familleId_fkey" FOREIGN KEY ("familleId") REFERENCES "FamilleProduit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SousCategorieProduit" ADD CONSTRAINT "SousCategorieProduit_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieProduit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_familleId_fkey" FOREIGN KEY ("familleId") REFERENCES "FamilleProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_sousFamilleId_fkey" FOREIGN KEY ("sousFamilleId") REFERENCES "SousFamilleProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_sousCategorieId_fkey" FOREIGN KEY ("sousCategorieId") REFERENCES "SousCategorieProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_marqueId_fkey" FOREIGN KEY ("marqueId") REFERENCES "MarqueProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_fournisseurPrincipalId_fkey" FOREIGN KEY ("fournisseurPrincipalId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_uniteVenteId_fkey" FOREIGN KEY ("uniteVenteId") REFERENCES "UniteProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_uniteAchatId_fkey" FOREIGN KEY ("uniteAchatId") REFERENCES "UniteProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
