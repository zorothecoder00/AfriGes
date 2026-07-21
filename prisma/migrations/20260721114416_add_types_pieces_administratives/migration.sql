-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'LETTRE_MOTIVATION';
ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'ACTE_NAISSANCE';
ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'CASIER_JUDICIAIRE';
ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'CERTIFICAT_MEDICAL';
ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'ATTESTATION_CNSS';
ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'COORDONNEES_BANCAIRES';
ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'CONTACT_URGENCE';
ALTER TYPE "TypeDocumentCollaborateur" ADD VALUE 'CORRESPONDANCE';
