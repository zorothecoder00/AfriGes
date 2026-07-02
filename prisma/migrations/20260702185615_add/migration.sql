/*
  Warnings:

  - You are about to drop the column `gestionnaireCredit` on the `CreditClient` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CreditClient" DROP COLUMN "gestionnaireCredit",
ADD COLUMN     "gestionnaireCreditId" INTEGER;

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_gestionnaireCreditId_fkey" FOREIGN KEY ("gestionnaireCreditId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
