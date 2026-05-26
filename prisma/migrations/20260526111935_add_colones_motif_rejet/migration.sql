-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MemberStatus" ADD VALUE 'EN_ATTENTE_VALIDATION';
ALTER TYPE "MemberStatus" ADD VALUE 'REJETE';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "dateValidation" TIMESTAMP(3),
ADD COLUMN     "motifRejet" TEXT,
ADD COLUMN     "validationParId" INTEGER;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_validationParId_fkey" FOREIGN KEY ("validationParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
