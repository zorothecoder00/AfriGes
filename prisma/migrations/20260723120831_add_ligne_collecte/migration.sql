/*
  Warnings:

  - A unique constraint covering the columns `[remboursementCreditId]` on the table `LigneCollecte` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LigneCollecte" ADD COLUMN     "remboursementCreditId" INTEGER;

-- AlterTable
ALTER TABLE "RemboursementCredit" ADD COLUMN     "compteCourantId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "LigneCollecte_remboursementCreditId_key" ON "LigneCollecte"("remboursementCreditId");

-- CreateIndex
CREATE INDEX "RemboursementCredit_compteCourantId_idx" ON "RemboursementCredit"("compteCourantId");

-- AddForeignKey
ALTER TABLE "RemboursementCredit" ADD CONSTRAINT "RemboursementCredit_compteCourantId_fkey" FOREIGN KEY ("compteCourantId") REFERENCES "CompteCourant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCollecte" ADD CONSTRAINT "LigneCollecte_remboursementCreditId_fkey" FOREIGN KEY ("remboursementCreditId") REFERENCES "RemboursementCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
