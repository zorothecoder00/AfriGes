-- CreateEnum
CREATE TYPE "TypeOperationTerrain" AS ENUM ('STREET_MARKETING', 'FLYERS', 'PORTE_A_PORTE', 'ANIMATION_MARCHE', 'DEGUSTATION', 'STAND', 'CARAVANE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutOperationTerrain" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutEvenement" AS ENUM ('PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutParticipantEvenement" AS ENUM ('INVITE', 'INSCRIT', 'PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "TypePartenaireMarketing" AS ENUM ('INFLUENCEUR', 'AFFILIE');

-- CreateTable
CREATE TABLE "OperationTerrain" (
    "id" SERIAL NOT NULL,
    "campagneId" INTEGER NOT NULL,
    "type" "TypeOperationTerrain" NOT NULL,
    "zone" TEXT NOT NULL,
    "pointDeVenteId" INTEGER,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "budget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "objectifsText" TEXT,
    "statut" "StatutOperationTerrain" NOT NULL DEFAULT 'PLANIFIEE',
    "prospectsGeneres" INTEGER NOT NULL DEFAULT 0,
    "clientsConvertis" INTEGER NOT NULL DEFAULT 0,
    "ventesGenereesCA" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "resultatsNotes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationTerrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationTerrainAgent" (
    "operationTerrainId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,

    CONSTRAINT "OperationTerrainAgent_pkey" PRIMARY KEY ("operationTerrainId","agentId")
);

-- CreateTable
CREATE TABLE "EvenementMarketing" (
    "id" SERIAL NOT NULL,
    "campagneId" INTEGER,
    "nom" TEXT NOT NULL,
    "lieu" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "budget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "partenaires" TEXT,
    "statut" "StatutEvenement" NOT NULL DEFAULT 'PLANIFIE',
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvenementMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantEvenement" (
    "id" SERIAL NOT NULL,
    "evenementId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "statut" "StatutParticipantEvenement" NOT NULL DEFAULT 'INVITE',
    "clientId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantEvenement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCodeMarketing" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "campagneId" INTEGER,
    "operationTerrainId" INTEGER,
    "evenementId" INTEGER,
    "landingPageId" INTEGER,
    "destinationUrl" TEXT,
    "nbScans" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrCodeMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPageMarketing" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "campagneId" INTEGER,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "produitId" INTEGER,
    "offreTexte" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "formulaireId" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "nbVues" INTEGER NOT NULL DEFAULT 0,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPageMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaireMarketing" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "campagneId" INTEGER,
    "champs" JSONB NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaireMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoumissionFormulaire" (
    "id" SERIAL NOT NULL,
    "formulaireId" INTEGER NOT NULL,
    "donnees" JSONB NOT NULL,
    "campagneId" INTEGER,
    "canal" TEXT,
    "pointDeVenteId" INTEGER,
    "qrCodeId" INTEGER,
    "landingPageId" INTEGER,
    "evenementId" INTEGER,
    "operationTerrainId" INTEGER,
    "clientIdCree" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoumissionFormulaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartenaireMarketing" (
    "id" SERIAL NOT NULL,
    "type" "TypePartenaireMarketing" NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "plateforme" TEXT,
    "audienceTaille" INTEGER,
    "tarif" DECIMAL(65,30),
    "commissionPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartenaireMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LienAffiliation" (
    "id" SERIAL NOT NULL,
    "partenaireId" INTEGER NOT NULL,
    "campagneId" INTEGER,
    "code" TEXT NOT NULL,
    "couponId" INTEGER,
    "destinationUrl" TEXT,
    "nbClics" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LienAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationTerrain_campagneId_idx" ON "OperationTerrain"("campagneId");

-- CreateIndex
CREATE INDEX "OperationTerrain_statut_idx" ON "OperationTerrain"("statut");

-- CreateIndex
CREATE INDEX "EvenementMarketing_campagneId_idx" ON "EvenementMarketing"("campagneId");

-- CreateIndex
CREATE INDEX "EvenementMarketing_statut_idx" ON "EvenementMarketing"("statut");

-- CreateIndex
CREATE INDEX "ParticipantEvenement_evenementId_idx" ON "ParticipantEvenement"("evenementId");

-- CreateIndex
CREATE UNIQUE INDEX "QrCodeMarketing_code_key" ON "QrCodeMarketing"("code");

-- CreateIndex
CREATE INDEX "QrCodeMarketing_campagneId_idx" ON "QrCodeMarketing"("campagneId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPageMarketing_slug_key" ON "LandingPageMarketing"("slug");

-- CreateIndex
CREATE INDEX "LandingPageMarketing_campagneId_idx" ON "LandingPageMarketing"("campagneId");

-- CreateIndex
CREATE UNIQUE INDEX "SoumissionFormulaire_clientIdCree_key" ON "SoumissionFormulaire"("clientIdCree");

-- CreateIndex
CREATE INDEX "SoumissionFormulaire_formulaireId_idx" ON "SoumissionFormulaire"("formulaireId");

-- CreateIndex
CREATE INDEX "SoumissionFormulaire_campagneId_idx" ON "SoumissionFormulaire"("campagneId");

-- CreateIndex
CREATE UNIQUE INDEX "LienAffiliation_code_key" ON "LienAffiliation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LienAffiliation_couponId_key" ON "LienAffiliation"("couponId");

-- CreateIndex
CREATE INDEX "LienAffiliation_partenaireId_idx" ON "LienAffiliation"("partenaireId");

-- CreateIndex
CREATE INDEX "LienAffiliation_campagneId_idx" ON "LienAffiliation"("campagneId");

-- AddForeignKey
ALTER TABLE "OperationTerrain" ADD CONSTRAINT "OperationTerrain_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationTerrain" ADD CONSTRAINT "OperationTerrain_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationTerrain" ADD CONSTRAINT "OperationTerrain_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationTerrainAgent" ADD CONSTRAINT "OperationTerrainAgent_operationTerrainId_fkey" FOREIGN KEY ("operationTerrainId") REFERENCES "OperationTerrain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationTerrainAgent" ADD CONSTRAINT "OperationTerrainAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementMarketing" ADD CONSTRAINT "EvenementMarketing_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementMarketing" ADD CONSTRAINT "EvenementMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEvenement" ADD CONSTRAINT "ParticipantEvenement_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "EvenementMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEvenement" ADD CONSTRAINT "ParticipantEvenement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCodeMarketing" ADD CONSTRAINT "QrCodeMarketing_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCodeMarketing" ADD CONSTRAINT "QrCodeMarketing_operationTerrainId_fkey" FOREIGN KEY ("operationTerrainId") REFERENCES "OperationTerrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCodeMarketing" ADD CONSTRAINT "QrCodeMarketing_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "EvenementMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCodeMarketing" ADD CONSTRAINT "QrCodeMarketing_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPageMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCodeMarketing" ADD CONSTRAINT "QrCodeMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageMarketing" ADD CONSTRAINT "LandingPageMarketing_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageMarketing" ADD CONSTRAINT "LandingPageMarketing_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageMarketing" ADD CONSTRAINT "LandingPageMarketing_formulaireId_fkey" FOREIGN KEY ("formulaireId") REFERENCES "FormulaireMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageMarketing" ADD CONSTRAINT "LandingPageMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaireMarketing" ADD CONSTRAINT "FormulaireMarketing_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaireMarketing" ADD CONSTRAINT "FormulaireMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_formulaireId_fkey" FOREIGN KEY ("formulaireId") REFERENCES "FormulaireMarketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCodeMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPageMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "EvenementMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_operationTerrainId_fkey" FOREIGN KEY ("operationTerrainId") REFERENCES "OperationTerrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoumissionFormulaire" ADD CONSTRAINT "SoumissionFormulaire_clientIdCree_fkey" FOREIGN KEY ("clientIdCree") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartenaireMarketing" ADD CONSTRAINT "PartenaireMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienAffiliation" ADD CONSTRAINT "LienAffiliation_partenaireId_fkey" FOREIGN KEY ("partenaireId") REFERENCES "PartenaireMarketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienAffiliation" ADD CONSTRAINT "LienAffiliation_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienAffiliation" ADD CONSTRAINT "LienAffiliation_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

