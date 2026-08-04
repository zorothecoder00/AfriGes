-- CreateEnum
CREATE TYPE "NatureDocumentJustificatif" AS ENUM ('FACTURE', 'RECU', 'BON_COMMANDE', 'BON_LIVRAISON', 'CONTRAT', 'RELEVE_BANCAIRE', 'PIECE_CAISSE', 'DOCUMENT_FISCAL', 'AUTRE');

-- AlterTable
ALTER TABLE "PieceJustificative" ADD COLUMN     "nature" "NatureDocumentJustificatif" NOT NULL DEFAULT 'AUTRE';
