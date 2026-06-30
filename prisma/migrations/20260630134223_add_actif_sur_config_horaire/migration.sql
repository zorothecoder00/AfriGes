-- AlterTable
ALTER TABLE "ConfigHoraire" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "ConfigHoraire_actif_idx" ON "ConfigHoraire"("actif");
