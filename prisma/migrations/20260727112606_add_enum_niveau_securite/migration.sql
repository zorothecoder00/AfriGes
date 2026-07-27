-- CreateEnum
CREATE TYPE "NiveauSecuriteSite" AS ENUM ('STANDARD', 'RENFORCE', 'MAXIMALE');

-- AlterTable
ALTER TABLE "PointDeVente" ADD COLUMN     "niveauSecurite" "NiveauSecuriteSite" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "responsableId" INTEGER;

-- AddForeignKey
ALTER TABLE "PointDeVente" ADD CONSTRAINT "PointDeVente_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
