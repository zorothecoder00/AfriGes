-- AlterTable
ALTER TABLE "EligibiliteClientRIA" ADD COLUMN     "nbCredits" INTEGER,
ADD COLUMN     "nbCreditsRetard" INTEGER,
ADD COLUMN     "nbPacks" INTEGER,
ADD COLUMN     "volumeCredits" DECIMAL(65,30);
