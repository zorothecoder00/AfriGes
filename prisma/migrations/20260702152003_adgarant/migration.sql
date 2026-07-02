-- AlterTable
ALTER TABLE "CreditClient" ADD COLUMN     "garantAdresse" TEXT,
ADD COLUMN     "garantNom" TEXT,
ADD COLUMN     "garantTelephone" TEXT,
ADD COLUMN     "garantTypeGarantie" TEXT,
ADD COLUMN     "garantValeurEstimee" DECIMAL(65,30) NOT NULL DEFAULT 0;
