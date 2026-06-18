-- AlterTable
ALTER TABLE "PlanActionCommRIA" ADD COLUMN     "reunionId" INTEGER;

-- CreateIndex
CREATE INDEX "PlanActionCommRIA_reunionId_idx" ON "PlanActionCommRIA"("reunionId");

-- AddForeignKey
ALTER TABLE "PlanActionCommRIA" ADD CONSTRAINT "PlanActionCommRIA_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionCommissionRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;
