-- AlterTable
ALTER TABLE "CollaborateurCompetence" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ObjectifKPI" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SuccesseurPotentiel" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true;
