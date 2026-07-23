-- CreateEnum
CREATE TYPE "TypeActiviteCollecte" AS ENUM ('PACK', 'CREDIT', 'VENTE', 'CC', 'CARNET', 'VISITE', 'NOUVEAU_CLIENT');

-- DropForeignKey
ALTER TABLE "LigneCollecte" DROP CONSTRAINT "LigneCollecte_souscriptionId_fkey";

-- AlterTable
ALTER TABLE "LigneCollecte" ADD COLUMN     "clientNouveauId" INTEGER,
ADD COLUMN     "creditId" INTEGER,
ADD COLUMN     "type" "TypeActiviteCollecte" NOT NULL DEFAULT 'PACK',
ADD COLUMN     "venteCarnetId" INTEGER,
ADD COLUMN     "venteDirecteId" INTEGER,
ADD COLUMN     "visiteId" INTEGER,
ALTER COLUMN "souscriptionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LigneCollecte_type_idx" ON "LigneCollecte"("type");

-- AddForeignKey
ALTER TABLE "LigneCollecte" ADD CONSTRAINT "LigneCollecte_souscriptionId_fkey" FOREIGN KEY ("souscriptionId") REFERENCES "SouscriptionPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
