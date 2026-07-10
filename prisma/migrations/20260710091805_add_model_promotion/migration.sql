-- CreateEnum
CREATE TYPE "TypeRemisePromotion" AS ENUM ('POURCENTAGE', 'MONTANT', 'LOT');

-- CreateEnum
CREATE TYPE "CiblePromotion" AS ENUM ('PRODUIT', 'CATEGORIE', 'FAMILLE', 'MARQUE', 'TOUS');

-- CreateTable
CREATE TABLE "Promotion" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "cible" "CiblePromotion" NOT NULL DEFAULT 'PRODUIT',
    "produitId" INTEGER,
    "categorieId" INTEGER,
    "familleId" INTEGER,
    "marqueId" INTEGER,
    "typeRemise" "TypeRemisePromotion" NOT NULL,
    "valeur" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lotAchete" INTEGER,
    "lotPaye" INTEGER,
    "pointDeVenteId" INTEGER,
    "segment" "SegmentClient",
    "clientId" INTEGER,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_actif_dateDebut_dateFin_idx" ON "Promotion"("actif", "dateDebut", "dateFin");

-- CreateIndex
CREATE INDEX "Promotion_cible_idx" ON "Promotion"("cible");

-- CreateIndex
CREATE INDEX "Promotion_produitId_idx" ON "Promotion"("produitId");

-- CreateIndex
CREATE INDEX "Promotion_categorieId_idx" ON "Promotion"("categorieId");

-- CreateIndex
CREATE INDEX "Promotion_familleId_idx" ON "Promotion"("familleId");

-- CreateIndex
CREATE INDEX "Promotion_marqueId_idx" ON "Promotion"("marqueId");

-- CreateIndex
CREATE INDEX "Promotion_pointDeVenteId_idx" ON "Promotion"("pointDeVenteId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategorieProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_familleId_fkey" FOREIGN KEY ("familleId") REFERENCES "FamilleProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_marqueId_fkey" FOREIGN KEY ("marqueId") REFERENCES "MarqueProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
