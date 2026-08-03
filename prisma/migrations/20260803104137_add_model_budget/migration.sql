-- CreateEnum
CREATE TYPE "AxeAnalytique" AS ENUM ('ACTIVITE', 'PROJET', 'DEPARTEMENT');

-- CreateEnum
CREATE TYPE "StatutBudget" AS ENUM ('BROUILLON', 'VALIDE');

-- AlterTable
ALTER TABLE "LigneEcriture" ADD COLUMN     "pointDeVenteId" INTEGER,
ADD COLUMN     "produitId" INTEGER,
ADD COLUMN     "sectionAnalytiqueId" INTEGER;

-- CreateTable
CREATE TABLE "SectionAnalytique" (
    "id" SERIAL NOT NULL,
    "axe" "AxeAnalytique" NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionAnalytique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "annee" INTEGER NOT NULL,
    "libelle" TEXT,
    "statut" "StatutBudget" NOT NULL DEFAULT 'BROUILLON',
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBudget" (
    "id" SERIAL NOT NULL,
    "budgetId" INTEGER NOT NULL,
    "compteId" INTEGER NOT NULL,
    "sectionAnalytiqueId" INTEGER,
    "pointDeVenteId" INTEGER,
    "mois" INTEGER NOT NULL,
    "montantPrevu" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionAnalytique_code_key" ON "SectionAnalytique"("code");

-- CreateIndex
CREATE INDEX "SectionAnalytique_axe_idx" ON "SectionAnalytique"("axe");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_annee_key" ON "Budget"("annee");

-- CreateIndex
CREATE INDEX "LigneBudget_budgetId_idx" ON "LigneBudget"("budgetId");

-- CreateIndex
CREATE INDEX "LigneBudget_compteId_idx" ON "LigneBudget"("compteId");

-- CreateIndex
CREATE INDEX "LigneBudget_mois_idx" ON "LigneBudget"("mois");

-- CreateIndex
CREATE INDEX "LigneEcriture_sectionAnalytiqueId_idx" ON "LigneEcriture"("sectionAnalytiqueId");

-- CreateIndex
CREATE INDEX "LigneEcriture_pointDeVenteId_idx" ON "LigneEcriture"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "LigneEcriture_produitId_idx" ON "LigneEcriture"("produitId");

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_sectionAnalytiqueId_fkey" FOREIGN KEY ("sectionAnalytiqueId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneEcriture" ADD CONSTRAINT "LigneEcriture_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBudget" ADD CONSTRAINT "LigneBudget_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBudget" ADD CONSTRAINT "LigneBudget_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBudget" ADD CONSTRAINT "LigneBudget_sectionAnalytiqueId_fkey" FOREIGN KEY ("sectionAnalytiqueId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBudget" ADD CONSTRAINT "LigneBudget_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
