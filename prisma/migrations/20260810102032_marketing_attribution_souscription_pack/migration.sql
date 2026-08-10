-- AlterTable
ALTER TABLE "SouscriptionPack" ADD COLUMN     "campagneId" INTEGER;

-- CreateIndex
CREATE INDEX "SouscriptionPack_campagneId_idx" ON "SouscriptionPack"("campagneId");

-- AddForeignKey
ALTER TABLE "SouscriptionPack" ADD CONSTRAINT "SouscriptionPack_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;
