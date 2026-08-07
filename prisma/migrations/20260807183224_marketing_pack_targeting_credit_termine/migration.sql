-- AlterEnum
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'CREDIT_TERMINE';

-- DropIndex
DROP INDEX "CampagneProduit_campagneId_produitId_familleId_key";

-- AlterTable
ALTER TABLE "CampagneProduit" ADD COLUMN     "packId" INTEGER;

-- CreateIndex
CREATE INDEX "CampagneProduit_packId_idx" ON "CampagneProduit"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "CampagneProduit_campagneId_produitId_familleId_packId_key" ON "CampagneProduit"("campagneId", "produitId", "familleId", "packId");

-- AddForeignKey
ALTER TABLE "CampagneProduit" ADD CONSTRAINT "CampagneProduit_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

