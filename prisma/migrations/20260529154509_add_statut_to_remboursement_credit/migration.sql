-- AlterTable
ALTER TABLE "RemboursementCredit" ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE_CAISSIER';

-- CreateIndex
CREATE INDEX "RemboursementCredit_statut_idx" ON "RemboursementCredit"("statut");
