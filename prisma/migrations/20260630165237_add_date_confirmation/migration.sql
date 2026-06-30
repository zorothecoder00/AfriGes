-- AlterTable
ALTER TABLE "RemboursementCredit" ADD COLUMN     "dateConfirmation" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RemboursementCredit_dateConfirmation_idx" ON "RemboursementCredit"("dateConfirmation");
