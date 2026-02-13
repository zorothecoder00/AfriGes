/*
  Warnings:

  - The values [AGENT,SUPERVISEUR] on the enum `RoleGestionnaire` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoleGestionnaire_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'RESPONSABLE_POINT_DE_VENTE', 'RESPONSABLE_COMMUNAUTE', 'REVENDEUR', 'AGENT_LOGISTIQUE_APPROVISIONNEMENT', 'MAGAZINIER', 'CAISSIER', 'COMMERCIAL', 'COMPTABLE', 'AUDITEUR_INTERNE', 'RESPONSABLE_VENTE_CREDIT', 'CONTROLEUR_TERRAIN', 'AGENT_TERRAIN', 'RESPONSABLE_ECONOMIQUE', 'RESPONSABLE_MARKETING', 'ACTIONNAIRE');
ALTER TABLE "Gestionnaire" ALTER COLUMN "role" TYPE "RoleGestionnaire_new" USING ("role"::text::"RoleGestionnaire_new");
ALTER TYPE "RoleGestionnaire" RENAME TO "RoleGestionnaire_old";
ALTER TYPE "RoleGestionnaire_new" RENAME TO "RoleGestionnaire";
DROP TYPE "public"."RoleGestionnaire_old";
COMMIT;
