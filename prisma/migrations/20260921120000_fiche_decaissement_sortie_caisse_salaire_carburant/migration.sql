-- AlterEnum
ALTER TYPE "CategorieDecaissement" ADD VALUE 'CARBURANT';

-- AlterEnum
ALTER TYPE "TypeDepenseDecaissement" ADD VALUE 'SALAIRE';
ALTER TYPE "TypeDepenseDecaissement" ADD VALUE 'CARBURANT';

-- AlterTable
ALTER TABLE "FicheDecaissement" ADD COLUMN     "operationCaisseId" INTEGER,
ADD COLUMN     "operationCaissePDVId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "FicheDecaissement_operationCaisseId_key" ON "FicheDecaissement"("operationCaisseId");

-- CreateIndex
CREATE UNIQUE INDEX "FicheDecaissement_operationCaissePDVId_key" ON "FicheDecaissement"("operationCaissePDVId");

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_operationCaisseId_fkey" FOREIGN KEY ("operationCaisseId") REFERENCES "OperationCaisse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheDecaissement" ADD CONSTRAINT "FicheDecaissement_operationCaissePDVId_fkey" FOREIGN KEY ("operationCaissePDVId") REFERENCES "OperationCaissePDV"("id") ON DELETE SET NULL ON UPDATE CASCADE;
