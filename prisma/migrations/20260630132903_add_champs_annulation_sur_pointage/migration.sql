-- AlterTable
ALTER TABLE "Pointage" ADD COLUMN     "annule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "annuleA" TIMESTAMP(3),
ADD COLUMN     "annuleParId" INTEGER,
ADD COLUMN     "motifAnnulation" TEXT;

-- CreateIndex
CREATE INDEX "Pointage_annule_idx" ON "Pointage"("annule");
