-- AlterTable
ALTER TABLE "MouvementCompteCourant" ADD COLUMN     "agentApporteurId" INTEGER,
ADD COLUMN     "dateOperation" TIMESTAMP(3),
ADD COLUMN     "numeroJour" INTEGER;

-- CreateIndex
CREATE INDEX "MouvementCompteCourant_agentApporteurId_idx" ON "MouvementCompteCourant"("agentApporteurId");

-- AddForeignKey
ALTER TABLE "MouvementCompteCourant" ADD CONSTRAINT "MouvementCompteCourant_agentApporteurId_fkey" FOREIGN KEY ("agentApporteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
