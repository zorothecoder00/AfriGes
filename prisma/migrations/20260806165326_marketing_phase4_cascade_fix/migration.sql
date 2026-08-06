-- DropForeignKey
ALTER TABLE "LogAutomatisation" DROP CONSTRAINT "LogAutomatisation_etapeId_fkey";

-- AddForeignKey
ALTER TABLE "LogAutomatisation" ADD CONSTRAINT "LogAutomatisation_etapeId_fkey" FOREIGN KEY ("etapeId") REFERENCES "EtapeAutomatisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
