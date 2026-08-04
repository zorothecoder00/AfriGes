-- CreateEnum
CREATE TYPE "StatutCompte" AS ENUM ('ACTIF', 'DESACTIVE', 'ARCHIVE', 'OBSOLETE');

-- AlterTable
ALTER TABLE "CompteComptable" ADD COLUMN     "statut" "StatutCompte" NOT NULL DEFAULT 'ACTIF';
