-- CreateEnum
CREATE TYPE "StatutAvanceSalaire" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE', 'REMBOURSE');

-- CreateEnum
CREATE TYPE "StatutPretEmploye" AS ENUM ('EN_COURS', 'SOLDE', 'EN_DEFAUT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutFichePaie" ADD VALUE 'CONTROLE';
ALTER TYPE "StatutFichePaie" ADD VALUE 'EN_PAIEMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeComposantSalaire" ADD VALUE 'PRIME_FONCTION';
ALTER TYPE "TypeComposantSalaire" ADD VALUE 'PRIME_RESPONSABILITE';
ALTER TYPE "TypeComposantSalaire" ADD VALUE 'COMMISSION';
ALTER TYPE "TypeComposantSalaire" ADD VALUE 'BONUS';
ALTER TYPE "TypeComposantSalaire" ADD VALUE 'PRIME_EXCEPTIONNELLE';
ALTER TYPE "TypeComposantSalaire" ADD VALUE 'DEDUCTION_RETARD';
ALTER TYPE "TypeComposantSalaire" ADD VALUE 'REMBOURSEMENT_PRET';
ALTER TYPE "TypeComposantSalaire" ADD VALUE 'SANCTION_FINANCIERE';

-- AlterTable
ALTER TABLE "ComposantSalaire" ADD COLUMN     "ordre" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FichePaie" ADD COLUMN     "controleParId" INTEGER,
ADD COLUMN     "dateControle" TIMESTAMP(3),
ADD COLUMN     "dateMiseEnPaiement" TIMESTAMP(3),
ADD COLUMN     "dateValidation" TIMESTAMP(3),
ADD COLUMN     "misEnPaiementParId" INTEGER,
ADD COLUMN     "modePaiement" TEXT,
ADD COLUMN     "valideParId" INTEGER;

-- CreateTable
CREATE TABLE "GrilleSalariale" (
    "id" SERIAL NOT NULL,
    "categorie" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "salaireMin" DECIMAL(65,30) NOT NULL,
    "salaireMax" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrilleSalariale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeComposantPaie" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "isRetenue" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TypeComposantPaie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaremeCommission" (
    "id" SERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "profilCible" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valeur" DECIMAL(65,30),
    "paliers" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaremeCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvanceSalaire" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "motif" TEXT,
    "echeancesMois" INTEGER NOT NULL DEFAULT 1,
    "montantRestant" DECIMAL(65,30) NOT NULL,
    "statut" "StatutAvanceSalaire" NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire" TEXT,
    "approuveParId" INTEGER,
    "dateApprobation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvanceSalaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PretEmploye" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "tauxInteret" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dureesMois" INTEGER NOT NULL,
    "montantMensuel" DECIMAL(65,30) NOT NULL,
    "montantRestant" DECIMAL(65,30) NOT NULL,
    "statut" "StatutPretEmploye" NOT NULL DEFAULT 'EN_COURS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PretEmploye_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrilleSalariale_categorie_niveau_key" ON "GrilleSalariale"("categorie", "niveau");

-- CreateIndex
CREATE UNIQUE INDEX "TypeComposantPaie_code_key" ON "TypeComposantPaie"("code");

-- CreateIndex
CREATE INDEX "AvanceSalaire_profilRHId_idx" ON "AvanceSalaire"("profilRHId");

-- CreateIndex
CREATE INDEX "AvanceSalaire_statut_idx" ON "AvanceSalaire"("statut");

-- CreateIndex
CREATE INDEX "PretEmploye_profilRHId_idx" ON "PretEmploye"("profilRHId");

-- CreateIndex
CREATE INDEX "PretEmploye_statut_idx" ON "PretEmploye"("statut");

-- AddForeignKey
ALTER TABLE "AvanceSalaire" ADD CONSTRAINT "AvanceSalaire_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PretEmploye" ADD CONSTRAINT "PretEmploye_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
