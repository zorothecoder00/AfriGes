-- CreateEnum
CREATE TYPE "StatutDepotRIA" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "StatutRetraitRIA" AS ENUM ('EN_ATTENTE', 'VALIDE', 'PAYE', 'REJETE');

-- CreateEnum
CREATE TYPE "StatutFinancementRIA" AS ENUM ('ACTIF', 'REMBOURSE', 'EN_RETARD', 'DEFAUT', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutDistributionRIA" AS ENUM ('PLANIFIE', 'EN_ATTENTE_PAIEMENT', 'DISTRIBUE', 'REINVESTI');

-- CreateEnum
CREATE TYPE "ClasseRisqueRIA" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "TypeMouvementRIA" AS ENUM ('DEPOT', 'RETRAIT', 'FINANCEMENT_CLIENT', 'REMBOURSEMENT_CLIENT', 'BENEFICE_GENERE', 'BENEFICE_DISTRIBUE', 'BENEFICE_REINVESTI', 'FOND_SECURITE', 'AJUSTEMENT');

-- AlterEnum
ALTER TYPE "RoleGestionnaire" ADD VALUE 'INVESTISSEUR_RIA';

-- CreateTable
CREATE TABLE "ProfilInvestisseurRIA" (
    "id" SERIAL NOT NULL,
    "gestionnaireId" INTEGER NOT NULL,
    "profession" TEXT,
    "pays" TEXT,
    "pieceIdentiteUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilInvestisseurRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortefeuilleRIA" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "profilRIAId" INTEGER NOT NULL,
    "nom" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "capitalInvesti" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "capitalDisponible" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "capitalEngage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "capitalRecouvre" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "capitalBloque" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "beneficesGeneres" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "beneficesDistribues" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "beneficesReinvestis" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fondSecurite" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortefeuilleRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffectationClientRIA" (
    "id" SERIAL NOT NULL,
    "portefeuilleId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "pourcentage" DECIMAL(65,30) NOT NULL,
    "montantAlloue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "classeRisque" "ClasseRisqueRIA" NOT NULL DEFAULT 'A',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffectationClientRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepotInvestisseur" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "portefeuilleId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "statut" "StatutDepotRIA" NOT NULL DEFAULT 'EN_ATTENTE',
    "modePaiement" TEXT,
    "justificatifUrl" TEXT,
    "notes" TEXT,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepotInvestisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetraitInvestisseur" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "portefeuilleId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "statut" "StatutRetraitRIA" NOT NULL DEFAULT 'EN_ATTENTE',
    "motif" TEXT,
    "modePaiement" TEXT,
    "notes" TEXT,
    "valideParId" INTEGER,
    "dateValidation" TIMESTAMP(3),
    "datePaiement" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetraitInvestisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementFondsRIA" (
    "id" SERIAL NOT NULL,
    "type" "TypeMouvementRIA" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "sens" TEXT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "portefeuilleId" INTEGER NOT NULL,
    "depotId" INTEGER,
    "retraitId" INTEGER,
    "financementId" INTEGER,
    "distributionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementFondsRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationFinancementRIA" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "portefeuilleId" INTEGER NOT NULL,
    "affectationId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "creditClientId" INTEGER,
    "montantFinance" DECIMAL(65,30) NOT NULL,
    "montantRembourse" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "encours" DECIMAL(65,30) NOT NULL,
    "statut" "StatutFinancementRIA" NOT NULL DEFAULT 'ACTIF',
    "dateFinancement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationFinancementRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemboursementRIA" (
    "id" SERIAL NOT NULL,
    "financementId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "remboursementCreditId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemboursementRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionBenefice" (
    "id" SERIAL NOT NULL,
    "portefeuilleId" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "capitalBase" DECIMAL(65,30) NOT NULL,
    "tauxGenere" DECIMAL(65,30) NOT NULL,
    "tauxDistribue" DECIMAL(65,30) NOT NULL,
    "tauxReinvesti" DECIMAL(65,30) NOT NULL,
    "tauxFondSecurite" DECIMAL(65,30) NOT NULL,
    "montantGenere" DECIMAL(65,30) NOT NULL,
    "montantDistribue" DECIMAL(65,30) NOT NULL,
    "montantReinvesti" DECIMAL(65,30) NOT NULL,
    "montantFondSecurite" DECIMAL(65,30) NOT NULL,
    "statut" "StatutDistributionRIA" NOT NULL DEFAULT 'PLANIFIE',
    "datePaiement" TIMESTAMP(3),
    "traitePar" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionBenefice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigBeneficeRIA" (
    "id" SERIAL NOT NULL,
    "tauxGenere" DECIMAL(65,30) NOT NULL DEFAULT 10,
    "tauxDistribue" DECIMAL(65,30) NOT NULL DEFAULT 4,
    "tauxReinvesti" DECIMAL(65,30) NOT NULL DEFAULT 4,
    "tauxFondSecurite" DECIMAL(65,30) NOT NULL DEFAULT 2,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigBeneficeRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentInvestisseur" (
    "id" SERIAL NOT NULL,
    "portefeuilleId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentInvestisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportMensuelRIA" (
    "id" SERIAL NOT NULL,
    "portefeuilleId" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "donnees" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "genereParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapportMensuelRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfilInvestisseurRIA_gestionnaireId_key" ON "ProfilInvestisseurRIA"("gestionnaireId");

-- CreateIndex
CREATE UNIQUE INDEX "PortefeuilleRIA_reference_key" ON "PortefeuilleRIA"("reference");

-- CreateIndex
CREATE INDEX "PortefeuilleRIA_profilRIAId_idx" ON "PortefeuilleRIA"("profilRIAId");

-- CreateIndex
CREATE INDEX "PortefeuilleRIA_actif_idx" ON "PortefeuilleRIA"("actif");

-- CreateIndex
CREATE INDEX "AffectationClientRIA_portefeuilleId_idx" ON "AffectationClientRIA"("portefeuilleId");

-- CreateIndex
CREATE INDEX "AffectationClientRIA_clientId_idx" ON "AffectationClientRIA"("clientId");

-- CreateIndex
CREATE INDEX "AffectationClientRIA_clientId_actif_idx" ON "AffectationClientRIA"("clientId", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "DepotInvestisseur_reference_key" ON "DepotInvestisseur"("reference");

-- CreateIndex
CREATE INDEX "DepotInvestisseur_portefeuilleId_idx" ON "DepotInvestisseur"("portefeuilleId");

-- CreateIndex
CREATE INDEX "DepotInvestisseur_statut_idx" ON "DepotInvestisseur"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "RetraitInvestisseur_reference_key" ON "RetraitInvestisseur"("reference");

-- CreateIndex
CREATE INDEX "RetraitInvestisseur_portefeuilleId_idx" ON "RetraitInvestisseur"("portefeuilleId");

-- CreateIndex
CREATE INDEX "RetraitInvestisseur_statut_idx" ON "RetraitInvestisseur"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "MouvementFondsRIA_depotId_key" ON "MouvementFondsRIA"("depotId");

-- CreateIndex
CREATE UNIQUE INDEX "MouvementFondsRIA_retraitId_key" ON "MouvementFondsRIA"("retraitId");

-- CreateIndex
CREATE INDEX "MouvementFondsRIA_portefeuilleId_idx" ON "MouvementFondsRIA"("portefeuilleId");

-- CreateIndex
CREATE INDEX "MouvementFondsRIA_type_idx" ON "MouvementFondsRIA"("type");

-- CreateIndex
CREATE INDEX "MouvementFondsRIA_createdAt_idx" ON "MouvementFondsRIA"("createdAt");

-- CreateIndex
CREATE INDEX "MouvementFondsRIA_financementId_idx" ON "MouvementFondsRIA"("financementId");

-- CreateIndex
CREATE INDEX "MouvementFondsRIA_distributionId_idx" ON "MouvementFondsRIA"("distributionId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationFinancementRIA_reference_key" ON "OperationFinancementRIA"("reference");

-- CreateIndex
CREATE INDEX "OperationFinancementRIA_portefeuilleId_idx" ON "OperationFinancementRIA"("portefeuilleId");

-- CreateIndex
CREATE INDEX "OperationFinancementRIA_clientId_idx" ON "OperationFinancementRIA"("clientId");

-- CreateIndex
CREATE INDEX "OperationFinancementRIA_statut_idx" ON "OperationFinancementRIA"("statut");

-- CreateIndex
CREATE INDEX "OperationFinancementRIA_creditClientId_idx" ON "OperationFinancementRIA"("creditClientId");

-- CreateIndex
CREATE INDEX "RemboursementRIA_financementId_idx" ON "RemboursementRIA"("financementId");

-- CreateIndex
CREATE INDEX "DistributionBenefice_portefeuilleId_idx" ON "DistributionBenefice"("portefeuilleId");

-- CreateIndex
CREATE INDEX "DistributionBenefice_mois_annee_idx" ON "DistributionBenefice"("mois", "annee");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionBenefice_portefeuilleId_mois_annee_key" ON "DistributionBenefice"("portefeuilleId", "mois", "annee");

-- CreateIndex
CREATE INDEX "DocumentInvestisseur_portefeuilleId_idx" ON "DocumentInvestisseur"("portefeuilleId");

-- CreateIndex
CREATE INDEX "RapportMensuelRIA_portefeuilleId_idx" ON "RapportMensuelRIA"("portefeuilleId");

-- CreateIndex
CREATE UNIQUE INDEX "RapportMensuelRIA_portefeuilleId_mois_annee_key" ON "RapportMensuelRIA"("portefeuilleId", "mois", "annee");

-- AddForeignKey
ALTER TABLE "ProfilInvestisseurRIA" ADD CONSTRAINT "ProfilInvestisseurRIA_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortefeuilleRIA" ADD CONSTRAINT "PortefeuilleRIA_profilRIAId_fkey" FOREIGN KEY ("profilRIAId") REFERENCES "ProfilInvestisseurRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationClientRIA" ADD CONSTRAINT "AffectationClientRIA_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectationClientRIA" ADD CONSTRAINT "AffectationClientRIA_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotInvestisseur" ADD CONSTRAINT "DepotInvestisseur_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotInvestisseur" ADD CONSTRAINT "DepotInvestisseur_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetraitInvestisseur" ADD CONSTRAINT "RetraitInvestisseur_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetraitInvestisseur" ADD CONSTRAINT "RetraitInvestisseur_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementFondsRIA" ADD CONSTRAINT "MouvementFondsRIA_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementFondsRIA" ADD CONSTRAINT "MouvementFondsRIA_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "DepotInvestisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementFondsRIA" ADD CONSTRAINT "MouvementFondsRIA_retraitId_fkey" FOREIGN KEY ("retraitId") REFERENCES "RetraitInvestisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementFondsRIA" ADD CONSTRAINT "MouvementFondsRIA_financementId_fkey" FOREIGN KEY ("financementId") REFERENCES "OperationFinancementRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementFondsRIA" ADD CONSTRAINT "MouvementFondsRIA_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "DistributionBenefice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationFinancementRIA" ADD CONSTRAINT "OperationFinancementRIA_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationFinancementRIA" ADD CONSTRAINT "OperationFinancementRIA_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "AffectationClientRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationFinancementRIA" ADD CONSTRAINT "OperationFinancementRIA_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationFinancementRIA" ADD CONSTRAINT "OperationFinancementRIA_creditClientId_fkey" FOREIGN KEY ("creditClientId") REFERENCES "CreditClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemboursementRIA" ADD CONSTRAINT "RemboursementRIA_financementId_fkey" FOREIGN KEY ("financementId") REFERENCES "OperationFinancementRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionBenefice" ADD CONSTRAINT "DistributionBenefice_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInvestisseur" ADD CONSTRAINT "DocumentInvestisseur_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportMensuelRIA" ADD CONSTRAINT "RapportMensuelRIA_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
