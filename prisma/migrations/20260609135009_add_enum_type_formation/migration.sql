-- CreateEnum
CREATE TYPE "TypeFormation" AS ENUM ('INTERNE', 'EXTERNE', 'ELEARNING');

-- AlterTable
ALTER TABLE "Formation" ADD COLUMN     "budgetAlloue" DECIMAL(65,30),
ADD COLUMN     "certificationNom" TEXT,
ADD COLUMN     "type" "TypeFormation";

-- CreateIndex
CREATE INDEX "Formation_type_idx" ON "Formation"("type");
