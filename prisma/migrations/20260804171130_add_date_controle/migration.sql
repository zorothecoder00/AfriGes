-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleGestionnaire" ADD VALUE 'CHEF_COMPTABLE';
ALTER TYPE "RoleGestionnaire" ADD VALUE 'DIRECTEUR_GENERAL';
ALTER TYPE "RoleGestionnaire" ADD VALUE 'RESPONSABLE_ACHATS';

-- AlterTable
ALTER TABLE "EcritureComptable" ADD COLUMN     "controleParId" INTEGER,
ADD COLUMN     "dateControle" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "EcritureComptable" ADD CONSTRAINT "EcritureComptable_controleParId_fkey" FOREIGN KEY ("controleParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
