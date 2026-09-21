-- AlterTable
ALTER TABLE "OperationCaisse" ADD COLUMN     "beneficiaireId" INTEGER;

-- AlterTable
ALTER TABLE "OperationCaissePDV" ADD COLUMN     "beneficiaireId" INTEGER;

-- AddForeignKey
ALTER TABLE "OperationCaissePDV" ADD CONSTRAINT "OperationCaissePDV_beneficiaireId_fkey" FOREIGN KEY ("beneficiaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationCaisse" ADD CONSTRAINT "OperationCaisse_beneficiaireId_fkey" FOREIGN KEY ("beneficiaireId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
