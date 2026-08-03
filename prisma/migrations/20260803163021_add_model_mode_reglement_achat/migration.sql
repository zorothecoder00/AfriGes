-- CreateEnum
CREATE TYPE "ModeReglementAchat" AS ENUM ('CREDIT', 'COMPTANT');

-- AlterTable
ALTER TABLE "ReceptionApprovisionnement" ADD COLUMN     "modePaiement" TEXT,
ADD COLUMN     "modeReglement" "ModeReglementAchat" NOT NULL DEFAULT 'CREDIT';
