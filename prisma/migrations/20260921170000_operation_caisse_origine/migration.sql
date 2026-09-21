-- CreateEnum
CREATE TYPE "OrigineOperationCaisse" AS ENUM ('SAISIE_MANUELLE', 'VENTE_DIRECTE', 'VENTE_TERRAIN', 'REMBOURSEMENT_CREDIT', 'VERSEMENT_PACK');

-- AlterTable
ALTER TABLE "OperationCaisse" ADD COLUMN     "origine" "OrigineOperationCaisse" NOT NULL DEFAULT 'SAISIE_MANUELLE';

-- AlterTable
ALTER TABLE "OperationCaissePDV" ADD COLUMN     "origine" "OrigineOperationCaisse" NOT NULL DEFAULT 'SAISIE_MANUELLE';

-- Rattrapage des opérations existantes : les encaissements générés par un autre flux (qui crée déjà
-- sa propre écriture comptable) sont repérés par le motif / la référence qu'ils posaient jusqu'ici.
-- Toute autre opération reste SAISIE_MANUELLE (valeur par défaut).
UPDATE "OperationCaisse" SET "origine" = 'VENTE_TERRAIN'
  WHERE "type" = 'ENCAISSEMENT' AND "motif" LIKE 'Vente terrain confirmée — %';
UPDATE "OperationCaisse" SET "origine" = 'REMBOURSEMENT_CREDIT'
  WHERE "type" = 'ENCAISSEMENT' AND "motif" LIKE 'Remboursement crédit confirmé — %';
UPDATE "OperationCaisse" SET "origine" = 'VERSEMENT_PACK'
  WHERE "type" = 'ENCAISSEMENT' AND "motif" LIKE 'Versement pack confirmé — %';
UPDATE "OperationCaisse" SET "origine" = 'VENTE_DIRECTE'
  WHERE "type" = 'ENCAISSEMENT' AND "origine" = 'SAISIE_MANUELLE'
    AND ("motif" LIKE 'Vente directe %' OR "reference" LIKE '%-CAISSE');

UPDATE "OperationCaissePDV" SET "origine" = 'VENTE_DIRECTE'
  WHERE "type" = 'ENCAISSEMENT' AND ("motif" LIKE 'Vente directe %' OR "reference" LIKE '%-CAISSE');
