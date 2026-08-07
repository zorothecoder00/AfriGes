-- CreateEnum
CREATE TYPE "NiveauValidationPublication" AS ENUM ('RESPONSABLE_MARKETING', 'DIRECTION');

-- AlterEnum
ALTER TYPE "RoleGestionnaire" ADD VALUE 'COMMUNITY_MANAGER';

-- AlterEnum
ALTER TYPE "StatutPublicationSociale" ADD VALUE 'EN_VALIDATION_DIRECTION';

-- AlterTable
ALTER TABLE "PublicationSociale" ADD COLUMN     "dateValidationDirection" TIMESTAMP(3),
ADD COLUMN     "niveauValidationRequis" "NiveauValidationPublication" NOT NULL DEFAULT 'RESPONSABLE_MARKETING',
ADD COLUMN     "valideParDirectionId" INTEGER;

-- AddForeignKey
ALTER TABLE "PublicationSociale" ADD CONSTRAINT "PublicationSociale_valideParDirectionId_fkey" FOREIGN KEY ("valideParDirectionId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

