-- V — Pièces jointes : simples cases à cocher (plus de n° de pages / n° de reçus)
ALTER TABLE "BordereauRemiseFonds" ADD COLUMN "fichesCollecteJointes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recusJoints" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "justificatifsJoints" BOOLEAN NOT NULL DEFAULT false;

-- Reprise : une plage saisie auparavant vaut case cochée
UPDATE "BordereauRemiseFonds" SET "fichesCollecteJointes" = true WHERE "fichesPagesDe" IS NOT NULL OR "fichesPagesA" IS NOT NULL;
UPDATE "BordereauRemiseFonds" SET "recusJoints" = true WHERE "recusNumDe" IS NOT NULL OR "recusNumA" IS NOT NULL;

ALTER TABLE "BordereauRemiseFonds" DROP COLUMN "fichesPagesDe",
DROP COLUMN "fichesPagesA",
DROP COLUMN "recusNumDe",
DROP COLUMN "recusNumA";
