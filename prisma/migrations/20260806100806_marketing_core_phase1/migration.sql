-- CreateEnum
CREATE TYPE "StatutCampagne" AS ENUM ('BROUILLON', 'PLANIFIEE', 'APPROUVEE', 'ACTIVE', 'PAUSE', 'TERMINEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "PorteeCampagne" AS ENUM ('NATIONALE', 'REGIONALE', 'AGENCE', 'POINT_DE_VENTE', 'COMMERCIALE');

-- CreateEnum
CREATE TYPE "ObjectifCampagneType" AS ENUM ('ACQUISITION', 'CONVERSION', 'FIDELISATION', 'REACTIVATION', 'CROSS_SELLING', 'UPSELLING', 'NOTORIETE', 'TRAFIC');

-- CreateEnum
CREATE TYPE "TypeAudience" AS ENUM ('STATIQUE', 'DYNAMIQUE');

-- CreateEnum
CREATE TYPE "ChampAudience" AS ENUM ('SEGMENT', 'TYPE_CLIENT', 'VILLE', 'COMMUNE', 'QUARTIER', 'SEXE', 'POINT_DE_VENTE', 'MONTANT_ACHAT_TOTAL', 'FREQUENCE_ACHAT', 'DERNIER_ACHAT_JOURS', 'PRODUIT_ACHETE', 'FAMILLE_PRODUIT_ACHETEE', 'STATUT_CREDIT', 'NIVEAU_FIDELITE', 'TAG');

-- CreateEnum
CREATE TYPE "OperateurAudience" AS ENUM ('EGAL', 'DIFFERENT', 'SUPERIEUR', 'INFERIEUR', 'SUPERIEUR_EGAL', 'INFERIEUR_EGAL', 'CONTIENT', 'DEPUIS_JOURS');

-- CreateEnum
CREATE TYPE "StatutBudgetMarketing" AS ENUM ('BROUILLON', 'DEMANDE', 'APPROUVE', 'REJETE');

-- CreateEnum
CREATE TYPE "CategorieDepenseMarketing" AS ENUM ('PUBLICITE', 'IMPRESSION', 'INFLUENCE', 'EVENEMENT', 'TRANSPORT', 'TERRAIN', 'SMS', 'WHATSAPP', 'EMAIL', 'MEDIA', 'SPONSORING', 'CREATION_GRAPHIQUE', 'AUTRE');

-- AlterTable
ALTER TABLE "CreditClient" ADD COLUMN     "campagneId" INTEGER;

-- AlterTable
ALTER TABLE "VenteDirecte" ADD COLUMN     "campagneId" INTEGER;

-- CreateTable
CREATE TABLE "TypeCampagne" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TypeCampagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanalMarketing" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanalMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceMarketing" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeAudience" NOT NULL DEFAULT 'DYNAMIQUE',
    "tailleCalculee" INTEGER,
    "dateDernierCalcul" TIMESTAMP(3),
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudienceMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceMarketingRegle" (
    "id" SERIAL NOT NULL,
    "audienceId" INTEGER NOT NULL,
    "champ" "ChampAudience" NOT NULL,
    "operateur" "OperateurAudience" NOT NULL,
    "valeur" TEXT NOT NULL,

    CONSTRAINT "AudienceMarketingRegle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceMarketingMembre" (
    "audienceId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,

    CONSTRAINT "AudienceMarketingMembre_pkey" PRIMARY KEY ("audienceId","clientId")
);

-- CreateTable
CREATE TABLE "Campagne" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "statut" "StatutCampagne" NOT NULL DEFAULT 'BROUILLON',
    "portee" "PorteeCampagne" NOT NULL DEFAULT 'AGENCE',
    "responsableId" INTEGER NOT NULL,
    "commercialId" INTEGER,
    "typeCampagneId" INTEGER NOT NULL,
    "brief" JSONB,
    "audienceId" INTEGER,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampagneObjectif" (
    "campagneId" INTEGER NOT NULL,
    "objectif" "ObjectifCampagneType" NOT NULL,

    CONSTRAINT "CampagneObjectif_pkey" PRIMARY KEY ("campagneId","objectif")
);

-- CreateTable
CREATE TABLE "CampagneAgence" (
    "campagneId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,

    CONSTRAINT "CampagneAgence_pkey" PRIMARY KEY ("campagneId","pointDeVenteId")
);

-- CreateTable
CREATE TABLE "CampagneProduit" (
    "id" SERIAL NOT NULL,
    "campagneId" INTEGER NOT NULL,
    "produitId" INTEGER,
    "familleId" INTEGER,

    CONSTRAINT "CampagneProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampagneCanal" (
    "campagneId" INTEGER NOT NULL,
    "canalId" INTEGER NOT NULL,

    CONSTRAINT "CampagneCanal_pkey" PRIMARY KEY ("campagneId","canalId")
);

-- CreateTable
CREATE TABLE "BudgetMarketing" (
    "id" SERIAL NOT NULL,
    "campagneId" INTEGER NOT NULL,
    "montantPrevu" DECIMAL(65,30) NOT NULL,
    "montantApprouve" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "montantEngage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutBudgetMarketing" NOT NULL DEFAULT 'BROUILLON',
    "demandeParId" INTEGER,
    "approuveParId" INTEGER,
    "dateApprobation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepenseMarketing" (
    "id" SERIAL NOT NULL,
    "campagneId" INTEGER NOT NULL,
    "budgetId" INTEGER,
    "categorie" "CategorieDepenseMarketing" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "ecritureComptableId" INTEGER,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepenseMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TypeCampagne_code_key" ON "TypeCampagne"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CanalMarketing_code_key" ON "CanalMarketing"("code");

-- CreateIndex
CREATE INDEX "AudienceMarketing_type_idx" ON "AudienceMarketing"("type");

-- CreateIndex
CREATE INDEX "AudienceMarketingRegle_audienceId_idx" ON "AudienceMarketingRegle"("audienceId");

-- CreateIndex
CREATE INDEX "AudienceMarketingMembre_clientId_idx" ON "AudienceMarketingMembre"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Campagne_code_key" ON "Campagne"("code");

-- CreateIndex
CREATE INDEX "Campagne_statut_idx" ON "Campagne"("statut");

-- CreateIndex
CREATE INDEX "Campagne_dateDebut_dateFin_idx" ON "Campagne"("dateDebut", "dateFin");

-- CreateIndex
CREATE INDEX "Campagne_responsableId_idx" ON "Campagne"("responsableId");

-- CreateIndex
CREATE INDEX "Campagne_typeCampagneId_idx" ON "Campagne"("typeCampagneId");

-- CreateIndex
CREATE INDEX "CampagneAgence_pointDeVenteId_idx" ON "CampagneAgence"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "CampagneProduit_produitId_idx" ON "CampagneProduit"("produitId");

-- CreateIndex
CREATE INDEX "CampagneProduit_familleId_idx" ON "CampagneProduit"("familleId");

-- CreateIndex
CREATE UNIQUE INDEX "CampagneProduit_campagneId_produitId_familleId_key" ON "CampagneProduit"("campagneId", "produitId", "familleId");

-- CreateIndex
CREATE INDEX "CampagneCanal_canalId_idx" ON "CampagneCanal"("canalId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetMarketing_campagneId_key" ON "BudgetMarketing"("campagneId");

-- CreateIndex
CREATE INDEX "DepenseMarketing_campagneId_idx" ON "DepenseMarketing"("campagneId");

-- CreateIndex
CREATE INDEX "DepenseMarketing_categorie_idx" ON "DepenseMarketing"("categorie");

-- CreateIndex
CREATE INDEX "CreditClient_campagneId_idx" ON "CreditClient"("campagneId");

-- CreateIndex
CREATE INDEX "VenteDirecte_campagneId_idx" ON "VenteDirecte"("campagneId");

-- AddForeignKey
ALTER TABLE "CreditClient" ADD CONSTRAINT "CreditClient_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceMarketing" ADD CONSTRAINT "AudienceMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceMarketingRegle" ADD CONSTRAINT "AudienceMarketingRegle_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AudienceMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceMarketingMembre" ADD CONSTRAINT "AudienceMarketingMembre_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AudienceMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceMarketingMembre" ADD CONSTRAINT "AudienceMarketingMembre_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campagne" ADD CONSTRAINT "Campagne_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campagne" ADD CONSTRAINT "Campagne_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campagne" ADD CONSTRAINT "Campagne_typeCampagneId_fkey" FOREIGN KEY ("typeCampagneId") REFERENCES "TypeCampagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campagne" ADD CONSTRAINT "Campagne_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AudienceMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campagne" ADD CONSTRAINT "Campagne_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneObjectif" ADD CONSTRAINT "CampagneObjectif_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneAgence" ADD CONSTRAINT "CampagneAgence_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneAgence" ADD CONSTRAINT "CampagneAgence_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneProduit" ADD CONSTRAINT "CampagneProduit_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneProduit" ADD CONSTRAINT "CampagneProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneProduit" ADD CONSTRAINT "CampagneProduit_familleId_fkey" FOREIGN KEY ("familleId") REFERENCES "FamilleProduit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneCanal" ADD CONSTRAINT "CampagneCanal_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneCanal" ADD CONSTRAINT "CampagneCanal_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "CanalMarketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMarketing" ADD CONSTRAINT "BudgetMarketing_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepenseMarketing" ADD CONSTRAINT "DepenseMarketing_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepenseMarketing" ADD CONSTRAINT "DepenseMarketing_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "BudgetMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
