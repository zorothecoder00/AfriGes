-- CreateEnum
CREATE TYPE "CategorieAsset" AS ENUM ('PHOTO', 'VIDEO', 'AFFICHE', 'LOGO', 'FLYER', 'BROCHURE', 'CATALOGUE', 'VIDEO_PROMO', 'TEMOIGNAGE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutPublicationSociale" AS ENUM ('IDEE', 'BROUILLON', 'EN_REVISION', 'VALIDE', 'PROGRAMME', 'PUBLIE', 'REJETE');

-- CreateTable
CREATE TABLE "AssetMarketing" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" "CategorieAsset" NOT NULL,
    "url" TEXT NOT NULL,
    "uploadthingKey" TEXT,
    "type" TEXT,
    "taille" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "droitsUtilisation" TEXT,
    "uploadeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMarketingCampagne" (
    "assetId" INTEGER NOT NULL,
    "campagneId" INTEGER NOT NULL,

    CONSTRAINT "AssetMarketingCampagne_pkey" PRIMARY KEY ("assetId","campagneId")
);

-- CreateTable
CREATE TABLE "PublicationSociale" (
    "id" SERIAL NOT NULL,
    "texte" TEXT,
    "statut" "StatutPublicationSociale" NOT NULL DEFAULT 'IDEE',
    "canalId" INTEGER NOT NULL,
    "campagneId" INTEGER,
    "pointDeVenteId" INTEGER,
    "produitId" INTEGER,
    "assetId" INTEGER,
    "responsableId" INTEGER NOT NULL,
    "datePublicationPrevue" TIMESTAMP(3),
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "datePublication" TIMESTAMP(3),
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationSociale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetMarketing_categorie_idx" ON "AssetMarketing"("categorie");

-- CreateIndex
CREATE INDEX "PublicationSociale_statut_idx" ON "PublicationSociale"("statut");

-- CreateIndex
CREATE INDEX "PublicationSociale_datePublicationPrevue_idx" ON "PublicationSociale"("datePublicationPrevue");

-- CreateIndex
CREATE INDEX "PublicationSociale_campagneId_idx" ON "PublicationSociale"("campagneId");

-- AddForeignKey
ALTER TABLE "AssetMarketing" ADD CONSTRAINT "AssetMarketing_uploadeParId_fkey" FOREIGN KEY ("uploadeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMarketingCampagne" ADD CONSTRAINT "AssetMarketingCampagne_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMarketingCampagne" ADD CONSTRAINT "AssetMarketingCampagne_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "CanalMarketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
