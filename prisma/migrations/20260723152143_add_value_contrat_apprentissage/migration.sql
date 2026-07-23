-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CONTRAT_APPRENTISSAGE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CONTRAT_PRESTATION';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'FICHE_INDIVIDUELLE_SALARIE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'FICHE_RENSEIGNEMENTS_PERSONNEL';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'DECLARATION_PRISE_SERVICE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'ACCUSE_RECEPTION_DOCUMENTS';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'LISTE_PIECES_ADMINISTRATIVES';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CHARTE_CONFIDENTIALITE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'ENGAGEMENT_CONFIDENTIALITE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'ENGAGEMENT_NON_CONCURRENCE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'ENGAGEMENT_REGLEMENT_INTERIEUR';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'FICHE_REMISE_MATERIEL';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'ACCEPTATION_DEMISSION';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'NOTIFICATION_LICENCIEMENT';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'MAINLEVEE_MATERIEL';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'FICHE_RESTITUTION_BIENS';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'QUITUS_ADMINISTRATIF';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'PV_SORTIE';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'ATTESTATION_FORMATION';
ALTER TYPE "TypeDocumentRHGenere" ADD VALUE 'CERTIFICAT_PARTICIPATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'FICHE_CREATION_POSTE';
ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'DESCRIPTION_POSTE';
ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'PROFIL_POSTE';
ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'DEMANDE_RECRUTEMENT';
ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'GRILLE_PRESELECTION';
ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'GUIDE_ENTRETIEN';
ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'GRILLE_EVALUATION_CANDIDATS';
ALTER TYPE "TypeDocumentRecrutement" ADD VALUE 'RAPPORT_ENTRETIEN';
