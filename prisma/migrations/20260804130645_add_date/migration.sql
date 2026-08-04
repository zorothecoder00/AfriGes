-- AlterTable
ALTER TABLE "EcritureComptable" ADD COLUMN     "dateValidation" TIMESTAMP(3),
ADD COLUMN     "valideParId" INTEGER;

-- AddForeignKey
ALTER TABLE "EcritureComptable" ADD CONSTRAINT "EcritureComptable_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
