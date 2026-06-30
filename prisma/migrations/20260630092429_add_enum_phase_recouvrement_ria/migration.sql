-- CreateEnum
CREATE TYPE "PhaseRecouvrementRIA" AS ENUM ('NORMAL', 'PRECONTENTIEUX', 'CONTENTIEUX', 'PERTE');

-- AlterTable
ALTER TABLE "OperationFinancementRIA" ADD COLUMN     "dateDernierEscalade" TIMESTAMP(3),
ADD COLUMN     "joursRetard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "niveauEscalade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phaseRecouvrement" "PhaseRecouvrementRIA" NOT NULL DEFAULT 'NORMAL';
