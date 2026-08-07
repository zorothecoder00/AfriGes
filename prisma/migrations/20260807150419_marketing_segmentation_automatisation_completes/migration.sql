-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionAutomatisation" ADD VALUE 'ATTRIBUER_COUPON';
ALTER TYPE "ActionAutomatisation" ADD VALUE 'ENVOYER_OFFRE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ChampAudience" ADD VALUE 'AGE';
ALTER TYPE "ChampAudience" ADD VALUE 'CANAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'DEUXIEME_ACHAT';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'CAMPAGNE';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'COUPON_UTILISE';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'POINT_FIDELITE';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'NOUVEAU_PRODUIT';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'STOCK_DISPONIBLE';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'PRODUIT_PREFERE';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'AGENCE_PROCHE';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'EVENEMENT';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'ABANDON';
ALTER TYPE "DeclencheurAutomatisation" ADD VALUE 'INTERACTION_MARKETING';

