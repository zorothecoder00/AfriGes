-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CONTRAT_CDI';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CONTRAT_CDD';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CONTRAT_STAGE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'AVENANT_CONTRAT';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CERTIFICAT_TRAVAIL';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'SOLDE_TOUT_COMPTE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'ATTESTATION_EMPLOI';
