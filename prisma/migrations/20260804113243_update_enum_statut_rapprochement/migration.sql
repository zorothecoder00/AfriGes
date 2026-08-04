-- CreateEnum
CREATE TYPE "NatureActif" AS ENUM ('CIRCULANT', 'IMMOBILISE');

-- AlterTable
ALTER TABLE "CompteComptable" ADD COLUMN     "autoriseLettrage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoriseRapprochement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "categorie" TEXT,
ADD COLUMN     "compteImmobilisationAssocieId" INTEGER,
ADD COLUMN     "compteTvaAssocieId" INTEGER,
ADD COLUMN     "creeParId" INTEGER,
ADD COLUMN     "estCompteBilan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estCompteCollectif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estCompteResultat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "natureActif" "NatureActif",
ADD COLUMN     "sectionAnalytiqueDefautId" INTEGER;

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_compteTvaAssocieId_fkey" FOREIGN KEY ("compteTvaAssocieId") REFERENCES "CompteComptable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_compteImmobilisationAssocieId_fkey" FOREIGN KEY ("compteImmobilisationAssocieId") REFERENCES "CompteComptable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_sectionAnalytiqueDefautId_fkey" FOREIGN KEY ("sectionAnalytiqueDefautId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
