-- AlterEnum
ALTER TYPE "StatutTransfertStock" ADD VALUE 'DEMANDE';

-- DropForeignKey
ALTER TABLE "TransfertStock" DROP CONSTRAINT "TransfertStock_origineId_fkey";

-- AlterTable
ALTER TABLE "TransfertStock" ADD COLUMN     "approuveParId" INTEGER,
ADD COLUMN     "dateApprobation" TIMESTAMP(3),
ALTER COLUMN "origineId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TransfertStock" ADD CONSTRAINT "TransfertStock_origineId_fkey" FOREIGN KEY ("origineId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertStock" ADD CONSTRAINT "TransfertStock_approuveParId_fkey" FOREIGN KEY ("approuveParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
