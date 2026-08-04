-- AlterEnum
ALTER TYPE "AxeAnalytique" ADD VALUE 'CENTRE_COUT';

-- AlterTable
ALTER TABLE "RegleComptable" ADD COLUMN     "centreCoutId" INTEGER,
ADD COLUMN     "compteTvaNumero" TEXT,
ADD COLUMN     "dateDebutValidite" TIMESTAMP(3),
ADD COLUMN     "dateFinValidite" TIMESTAMP(3),
ADD COLUMN     "devise" TEXT,
ADD COLUMN     "sectionAnalytiqueId" INTEGER;

-- AddForeignKey
ALTER TABLE "RegleComptable" ADD CONSTRAINT "RegleComptable_sectionAnalytiqueId_fkey" FOREIGN KEY ("sectionAnalytiqueId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegleComptable" ADD CONSTRAINT "RegleComptable_centreCoutId_fkey" FOREIGN KEY ("centreCoutId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;
