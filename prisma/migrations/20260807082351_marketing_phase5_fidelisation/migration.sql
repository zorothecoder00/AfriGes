-- CreateEnum
CREATE TYPE "TypeObjectifChallenge" AS ENUM ('NB_ACHATS', 'MONTANT_ACHATS');

-- CreateEnum
CREATE TYPE "StatutChallenge" AS ENUM ('ACTIF', 'TERMINE');

-- CreateEnum
CREATE TYPE "StatutParticipationChallenge" AS ENUM ('EN_COURS', 'REUSSI');

-- CreateEnum
CREATE TYPE "StatutParrainage" AS ENUM ('EN_ATTENTE', 'QUALIFIE', 'RECOMPENSE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "codeParrainage" TEXT;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "campagneId" INTEGER;

-- AlterTable
ALTER TABLE "VenteDirecte" ADD COLUMN     "couponId" INTEGER;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "campagneId" INTEGER,
    "typeRemise" "TypeRemisePromotion" NOT NULL,
    "valeur" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "audienceId" INTEGER,
    "pointDeVenteId" INTEGER,
    "produitId" INTEGER,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "utilisationMax" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponUtilisation" (
    "id" SERIAL NOT NULL,
    "couponId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "venteId" INTEGER,
    "montantRemise" DECIMAL(65,30) NOT NULL,
    "dateUtilisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUtilisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecompenseEchange" (
    "id" SERIAL NOT NULL,
    "recompenseId" INTEGER NOT NULL,
    "compteFideliteId" INTEGER NOT NULL,
    "pointsUtilises" INTEGER NOT NULL,
    "statut" "StatutRecompense" NOT NULL DEFAULT 'DISPONIBLE',
    "dateUtilisation" TIMESTAMP(3),
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecompenseEchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeMarketing" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "typeObjectif" "TypeObjectifChallenge" NOT NULL,
    "seuil" INTEGER NOT NULL,
    "recompensePoints" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "statut" "StatutChallenge" NOT NULL DEFAULT 'ACTIF',
    "segment" "SegmentClient",
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipationChallenge" (
    "id" SERIAL NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "progression" INTEGER NOT NULL DEFAULT 0,
    "statut" "StatutParticipationChallenge" NOT NULL DEFAULT 'EN_COURS',
    "dateReussite" TIMESTAMP(3),

    CONSTRAINT "ParticipationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeMarketing" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "icone" TEXT,
    "condition" JSONB NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeClient" (
    "id" SERIAL NOT NULL,
    "badgeId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "dateAttribution" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametrageParrainage" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "pointsParrain" INTEGER NOT NULL DEFAULT 500,
    "pointsFilleul" INTEGER NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametrageParrainage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parrainage" (
    "id" SERIAL NOT NULL,
    "parrainId" INTEGER NOT NULL,
    "filleulId" INTEGER NOT NULL,
    "statut" "StatutParrainage" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateQualification" TIMESTAMP(3),
    "dateRecompense" TIMESTAMP(3),

    CONSTRAINT "Parrainage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_actif_dateDebut_dateFin_idx" ON "Coupon"("actif", "dateDebut", "dateFin");

-- CreateIndex
CREATE INDEX "Coupon_campagneId_idx" ON "Coupon"("campagneId");

-- CreateIndex
CREATE INDEX "CouponUtilisation_couponId_idx" ON "CouponUtilisation"("couponId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponUtilisation_couponId_clientId_key" ON "CouponUtilisation"("couponId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationChallenge_challengeId_clientId_key" ON "ParticipationChallenge"("challengeId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeClient_badgeId_clientId_key" ON "BadgeClient"("badgeId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Parrainage_filleulId_key" ON "Parrainage"("filleulId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_codeParrainage_key" ON "Client"("codeParrainage");

-- CreateIndex
CREATE INDEX "Promotion_campagneId_idx" ON "Promotion"("campagneId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AudienceMarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUtilisation" ADD CONSTRAINT "CouponUtilisation_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUtilisation" ADD CONSTRAINT "CouponUtilisation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUtilisation" ADD CONSTRAINT "CouponUtilisation_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "VenteDirecte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenteDirecte" ADD CONSTRAINT "VenteDirecte_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecompenseEchange" ADD CONSTRAINT "RecompenseEchange_recompenseId_fkey" FOREIGN KEY ("recompenseId") REFERENCES "RecompenseFidelite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecompenseEchange" ADD CONSTRAINT "RecompenseEchange_compteFideliteId_fkey" FOREIGN KEY ("compteFideliteId") REFERENCES "CompteFidelite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecompenseEchange" ADD CONSTRAINT "RecompenseEchange_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeMarketing" ADD CONSTRAINT "ChallengeMarketing_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationChallenge" ADD CONSTRAINT "ParticipationChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "ChallengeMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationChallenge" ADD CONSTRAINT "ParticipationChallenge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeClient" ADD CONSTRAINT "BadgeClient_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeMarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeClient" ADD CONSTRAINT "BadgeClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parrainage" ADD CONSTRAINT "Parrainage_parrainId_fkey" FOREIGN KEY ("parrainId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parrainage" ADD CONSTRAINT "Parrainage_filleulId_fkey" FOREIGN KEY ("filleulId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

