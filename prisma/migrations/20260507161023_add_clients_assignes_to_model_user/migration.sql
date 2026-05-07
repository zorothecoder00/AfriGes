-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "agentTerrainId" INTEGER;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agentTerrainId_fkey" FOREIGN KEY ("agentTerrainId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
