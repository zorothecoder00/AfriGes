-- AlterEnum
ALTER TYPE "StatutInventaire" ADD VALUE 'SOUMIS';

-- AlterTable
ALTER TABLE "InventaireSite" ADD COLUMN     "commentaireValidation" TEXT,
ADD COLUMN     "dateSoumission" TIMESTAMP(3),
ADD COLUMN     "dateValidation" TIMESTAMP(3);
