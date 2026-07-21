-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'AVERTISSEMENT_ECRIT';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'MISE_EN_DEMEURE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'DEMANDE_EXPLICATION';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CONVOCATION_DISCIPLINAIRE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'PV_AUDITION';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'DECISION_DISCIPLINAIRE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'MISE_A_PIED';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'LETTRE_LICENCIEMENT';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'PV_RUPTURE';
