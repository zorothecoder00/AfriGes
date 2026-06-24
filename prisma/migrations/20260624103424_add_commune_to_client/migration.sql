-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "commune" TEXT;

-- CreateIndex
CREATE INDEX "Client_commune_idx" ON "Client"("commune");
