-- CreateEnum
CREATE TYPE "StatutPropositionOCR" AS ENUM ('ANALYSE', 'VALIDEE', 'REJETEE');

-- AlterTable
ALTER TABLE "BonSortie" ADD COLUMN     "ecritureId" INTEGER;

-- AlterTable
ALTER TABLE "CategorieProduit" ADD COLUMN     "compteAchat" TEXT,
ADD COLUMN     "compteStock" TEXT,
ADD COLUMN     "compteTvaAchat" TEXT,
ADD COLUMN     "compteTvaVente" TEXT,
ADD COLUMN     "compteVariationStock" TEXT,
ADD COLUMN     "compteVente" TEXT,
ADD COLUMN     "sectionAnalytiqueDefautId" INTEGER;

-- AlterTable
ALTER TABLE "ConfigurationComptableInitiale" ADD COLUMN     "compteAchatDefaut" TEXT,
ADD COLUMN     "compteStockDefaut" TEXT,
ADD COLUMN     "compteTvaAchatDefaut" TEXT,
ADD COLUMN     "compteTvaVenteDefaut" TEXT,
ADD COLUMN     "compteVariationStockDefaut" TEXT,
ADD COLUMN     "compteVenteDefaut" TEXT;

-- AlterTable
ALTER TABLE "DemandeAjustementStock" ADD COLUMN     "ecritureId" INTEGER;

-- AlterTable
ALTER TABLE "FamilleProduit" ADD COLUMN     "compteAchat" TEXT,
ADD COLUMN     "compteStock" TEXT,
ADD COLUMN     "compteTvaAchat" TEXT,
ADD COLUMN     "compteTvaVente" TEXT,
ADD COLUMN     "compteVariationStock" TEXT,
ADD COLUMN     "compteVente" TEXT,
ADD COLUMN     "sectionAnalytiqueDefautId" INTEGER;

-- AlterTable
ALTER TABLE "Produit" ADD COLUMN     "compteAchat" TEXT,
ADD COLUMN     "compteStock" TEXT,
ADD COLUMN     "compteTvaAchat" TEXT,
ADD COLUMN     "compteTvaVente" TEXT,
ADD COLUMN     "compteVariationStock" TEXT,
ADD COLUMN     "compteVente" TEXT,
ADD COLUMN     "sectionAnalytiqueDefautId" INTEGER;

-- AlterTable
ALTER TABLE "RegleComptable" ADD COLUMN     "conditionPointDeVente" INTEGER,
ADD COLUMN     "conditionTypeClient" TEXT,
ADD COLUMN     "conditionTypeSortie" TEXT;

-- AlterTable
ALTER TABLE "TransfertStock" ADD COLUMN     "ecritureId" INTEGER;

-- CreateTable
CREATE TABLE "PropositionImputationOCR" (
    "id" SERIAL NOT NULL,
    "pieceJustificativeId" INTEGER NOT NULL,
    "fournisseurDetecte" TEXT,
    "fournisseurIdMatche" INTEGER,
    "dateDetectee" TEXT,
    "numeroDetecte" TEXT,
    "montantHT" DECIMAL(65,30),
    "montantTVA" DECIMAL(65,30),
    "montantTTC" DECIMAL(65,30),
    "lignesJson" JSONB,
    "compteDebitProbable" TEXT,
    "compteCreditProbable" TEXT,
    "statut" "StatutPropositionOCR" NOT NULL DEFAULT 'ANALYSE',
    "ecritureCreeeId" INTEGER,
    "analyseParId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropositionImputationOCR_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropositionImputationOCR_pieceJustificativeId_key" ON "PropositionImputationOCR"("pieceJustificativeId");

-- CreateIndex
CREATE INDEX "PropositionImputationOCR_statut_idx" ON "PropositionImputationOCR"("statut");

-- AddForeignKey
ALTER TABLE "FamilleProduit" ADD CONSTRAINT "FamilleProduit_sectionAnalytiqueDefautId_fkey" FOREIGN KEY ("sectionAnalytiqueDefautId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorieProduit" ADD CONSTRAINT "CategorieProduit_sectionAnalytiqueDefautId_fkey" FOREIGN KEY ("sectionAnalytiqueDefautId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_sectionAnalytiqueDefautId_fkey" FOREIGN KEY ("sectionAnalytiqueDefautId") REFERENCES "SectionAnalytique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropositionImputationOCR" ADD CONSTRAINT "PropositionImputationOCR_pieceJustificativeId_fkey" FOREIGN KEY ("pieceJustificativeId") REFERENCES "PieceJustificative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropositionImputationOCR" ADD CONSTRAINT "PropositionImputationOCR_fournisseurIdMatche_fkey" FOREIGN KEY ("fournisseurIdMatche") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropositionImputationOCR" ADD CONSTRAINT "PropositionImputationOCR_analyseParId_fkey" FOREIGN KEY ("analyseParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropositionImputationOCR" ADD CONSTRAINT "PropositionImputationOCR_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
