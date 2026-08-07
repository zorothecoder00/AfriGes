-- DropIndex
DROP INDEX "SoumissionFormulaire_clientIdCree_key";

-- CreateIndex
CREATE INDEX "SoumissionFormulaire_clientIdCree_idx" ON "SoumissionFormulaire"("clientIdCree");

