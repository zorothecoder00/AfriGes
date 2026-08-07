-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleGestionnaire" ADD VALUE 'DIRECTEUR_MARKETING';
ALTER TYPE "RoleGestionnaire" ADD VALUE 'MARKETING_TERRAIN';

-- AlterEnum
ALTER TYPE "StatutTestAB" ADD VALUE 'DEPLOYE';

-- AlterTable
ALTER TABLE "Campagne" ADD COLUMN     "roiCible" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "prefB2B" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prefEvenements" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prefFidelite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prefNouveautes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prefPromotions" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ParametrageMarketing" ADD COLUMN     "seuilAudienceMinimale" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "TestAB" ADD COLUMN     "dateDeploiement" TIMESTAMP(3),
ADD COLUMN     "tailleEchantillon" INTEGER,
ADD COLUMN     "varianteDeployee" "VarianteTestAB";

-- CreateTable
CREATE TABLE "EvenementSysteme" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvenementSysteme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvenementSysteme_type_createdAt_idx" ON "EvenementSysteme"("type", "createdAt");

