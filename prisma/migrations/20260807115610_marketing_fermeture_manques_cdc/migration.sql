-- CreateEnum
CREATE TYPE "TypeZoneChalandise" AS ENUM ('VILLE', 'COMMUNE', 'QUARTIER', 'MARCHE', 'ENTREPRISE', 'ECOLE', 'INSTITUTION');

-- AlterEnum
ALTER TYPE "ChampAudience" ADD VALUE 'DISTANCE_AGENCE_KM';

-- AlterTable
ALTER TABLE "CampagneObjectif" DROP CONSTRAINT "CampagneObjectif_pkey",
DROP COLUMN "objectif",
ADD COLUMN     "objectifId" INTEGER NOT NULL,
ADD CONSTRAINT "CampagneObjectif_pkey" PRIMARY KEY ("campagneId", "objectifId");

-- AlterTable
ALTER TABLE "DepenseMarketing" ADD COLUMN     "modePaiement" TEXT;

-- DropEnum
DROP TYPE "ObjectifCampagneType";

-- CreateTable
CREATE TABLE "ObjectifCampagne" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectifCampagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneChalandise" (
    "id" SERIAL NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "type" "TypeZoneChalandise" NOT NULL,
    "nom" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneChalandise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametrageRFM" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "seuilPerduJours" INTEGER NOT NULL DEFAULT 180,
    "seuilDormantJours" INTEGER NOT NULL DEFAULT 90,
    "seuilRisqueJours" INTEGER NOT NULL DEFAULT 60,
    "seuilRisqueFrequenceMin" INTEGER NOT NULL DEFAULT 2,
    "percentileGrosAcheteur" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "seuilChampionFrequence" INTEGER NOT NULL DEFAULT 5,
    "seuilChampionRecenceJours" INTEGER NOT NULL DEFAULT 30,
    "seuilFideleFrequence" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametrageRFM_pkey" PRIMARY KEY ("id")
);

-- Seed : 8 objectifs historiques (ex-ObjectifCampagneType, CDC §81 sans code)
INSERT INTO "ObjectifCampagne" ("code", "libelle", "ordre", "updatedAt") VALUES
  ('ACQUISITION', 'Acquisition', 0, CURRENT_TIMESTAMP),
  ('CONVERSION', 'Conversion', 1, CURRENT_TIMESTAMP),
  ('FIDELISATION', 'Fidélisation', 2, CURRENT_TIMESTAMP),
  ('REACTIVATION', 'Réactivation', 3, CURRENT_TIMESTAMP),
  ('CROSS_SELLING', 'Cross-selling', 4, CURRENT_TIMESTAMP),
  ('UPSELLING', 'Upselling', 5, CURRENT_TIMESTAMP),
  ('NOTORIETE', 'Notoriété', 6, CURRENT_TIMESTAMP),
  ('TRAFIC', 'Trafic', 7, CURRENT_TIMESTAMP);

-- Seed : paramétrage RFM singleton (valeurs par défaut = seuils historiques en dur)
INSERT INTO "ParametrageRFM" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);

-- CreateIndex
CREATE UNIQUE INDEX "ObjectifCampagne_code_key" ON "ObjectifCampagne"("code");

-- CreateIndex
CREATE INDEX "ZoneChalandise_pointDeVenteId_idx" ON "ZoneChalandise"("pointDeVenteId");

-- AddForeignKey
ALTER TABLE "CampagneObjectif" ADD CONSTRAINT "CampagneObjectif_objectifId_fkey" FOREIGN KEY ("objectifId") REFERENCES "ObjectifCampagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepenseMarketing" ADD CONSTRAINT "DepenseMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneChalandise" ADD CONSTRAINT "ZoneChalandise_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

