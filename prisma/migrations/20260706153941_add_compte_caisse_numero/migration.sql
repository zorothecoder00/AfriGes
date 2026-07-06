-- AlterTable
ALTER TABLE "ParametrageCompteCourant" ADD COLUMN     "compteCaisseNumero" TEXT NOT NULL DEFAULT '571',
ADD COLUMN     "compteCourantClientNumero" TEXT NOT NULL DEFAULT '419',
ADD COLUMN     "compteVentesNumero" TEXT NOT NULL DEFAULT '701';
