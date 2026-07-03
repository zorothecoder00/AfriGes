-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutAvanceSalaire" ADD VALUE 'VALIDE_MANAGER';
ALTER TYPE "StatutAvanceSalaire" ADD VALUE 'ANNULE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutPretEmploye" ADD VALUE 'EN_ATTENTE';
ALTER TYPE "StatutPretEmploye" ADD VALUE 'VALIDE_MANAGER';
ALTER TYPE "StatutPretEmploye" ADD VALUE 'REJETE';
ALTER TYPE "StatutPretEmploye" ADD VALUE 'ANNULE';

-- AlterTable
ALTER TABLE "AvanceSalaire" ADD COLUMN     "dateValidationManager" TIMESTAMP(3),
ADD COLUMN     "demandeParId" INTEGER,
ADD COLUMN     "valideManagerParId" INTEGER;

-- AlterTable
ALTER TABLE "PretEmploye" ADD COLUMN     "approuveParId" INTEGER,
ADD COLUMN     "commentaire" TEXT,
ADD COLUMN     "dateApprobation" TIMESTAMP(3),
ADD COLUMN     "dateValidationManager" TIMESTAMP(3),
ADD COLUMN     "demandeParId" INTEGER,
ADD COLUMN     "motif" TEXT,
ADD COLUMN     "valideManagerParId" INTEGER;
