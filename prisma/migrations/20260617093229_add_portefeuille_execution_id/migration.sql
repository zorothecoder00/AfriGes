-- AlterTable
ALTER TABLE "DossierInterCommission" ADD COLUMN     "portefeuilleExecutionId" INTEGER;

-- CreateIndex
CREATE INDEX "DossierInterCommission_portefeuilleExecutionId_idx" ON "DossierInterCommission"("portefeuilleExecutionId");

-- AddForeignKey
ALTER TABLE "DossierInterCommission" ADD CONSTRAINT "DossierInterCommission_portefeuilleExecutionId_fkey" FOREIGN KEY ("portefeuilleExecutionId") REFERENCES "PortefeuilleRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;
