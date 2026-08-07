-- AlterEnum
ALTER TYPE "ChampAudience" ADD VALUE 'REGION';

-- AlterEnum
ALTER TYPE "StatutBudgetMarketing" ADD VALUE 'EN_VALIDATION_DIRECTION';

-- AlterTable
ALTER TABLE "BudgetMarketing" ADD COLUMN     "dateValidationResponsable" TIMESTAMP(3),
ADD COLUMN     "valideParResponsableId" INTEGER;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "region" TEXT;

