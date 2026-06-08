-- CreateEnum
CREATE TYPE "StatutFichePaie" AS ENUM ('BROUILLON', 'VALIDE', 'PAYE');

-- CreateEnum
CREATE TYPE "TypeComposantSalaire" AS ENUM ('SALAIRE_BASE', 'PRIME_PERFORMANCE', 'PRIME_ANCIENNETE', 'PRIME_TRANSPORT', 'PRIME_LOGEMENT', 'HEURES_SUPPLEMENTAIRES', 'INDEMNITE_MISSION', 'DEDUCTION_ABSENCE', 'COTISATION_RETRAITE', 'COTISATION_SANTE', 'IMPOT_REVENU', 'AVANCE_SUR_SALAIRE', 'AUTRE_GAIN', 'AUTRE_RETENUE');

-- CreateEnum
CREATE TYPE "StatutFormation" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutParticipationFormation" AS ENUM ('INSCRIT', 'PRESENT', 'ABSENT', 'CERTIFIE');

-- CreateEnum
CREATE TYPE "StatutPointage" AS ENUM ('PRESENT', 'ABSENT', 'RETARD', 'DEMI_JOURNEE', 'CONGE', 'MISSION', 'FERIE');

-- CreateEnum
CREATE TYPE "SourcePointage" AS ENUM ('MANUEL', 'IMPORT');

-- CreateEnum
CREATE TYPE "TypeAvantageRH" AS ENUM ('TRANSPORT', 'LOGEMENT', 'TELEPHONE', 'REPAS', 'VEHICULE', 'ASSURANCE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeRemboursementFrais" AS ENUM ('DEPLACEMENT', 'REPAS', 'HEBERGEMENT', 'COMMUNICATION', 'MATERIEL', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutRemboursementFrais" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE', 'PAYE');

-- CreateTable
CREATE TABLE "FichePaie" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "salaireBase" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBrut" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalRetenues" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAPayer" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutFichePaie" NOT NULL DEFAULT 'BROUILLON',
    "fichierUrl" TEXT,
    "notes" TEXT,
    "genereParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FichePaie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposantSalaire" (
    "id" SERIAL NOT NULL,
    "fichePaieId" INTEGER NOT NULL,
    "type" "TypeComposantSalaire" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "isRetenue" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ComposantSalaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "objectifs" TEXT,
    "lieu" TEXT,
    "formateur" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "dureeHeures" INTEGER,
    "cout" DECIMAL(65,30),
    "statut" "StatutFormation" NOT NULL DEFAULT 'PLANIFIEE',
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipationFormation" (
    "id" SERIAL NOT NULL,
    "formationId" INTEGER NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "statut" "StatutParticipationFormation" NOT NULL DEFAULT 'INSCRIT',
    "note" DECIMAL(65,30),
    "certificatUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipationFormation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heureArrivee" TIMESTAMP(3),
    "heureDepart" TIMESTAMP(3),
    "statut" "StatutPointage" NOT NULL DEFAULT 'PRESENT',
    "source" "SourcePointage" NOT NULL DEFAULT 'MANUEL',
    "notes" TEXT,
    "saisieParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvantageRH" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeAvantageRH" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantMensuel" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvantageRH_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemboursementFrais" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeRemboursementFrais" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "dateFrais" TIMESTAMP(3) NOT NULL,
    "justificatif" TEXT,
    "statut" "StatutRemboursementFrais" NOT NULL DEFAULT 'EN_ATTENTE',
    "traiteParId" INTEGER,
    "commentaire" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemboursementFrais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FichePaie_profilRHId_idx" ON "FichePaie"("profilRHId");

-- CreateIndex
CREATE INDEX "FichePaie_statut_idx" ON "FichePaie"("statut");

-- CreateIndex
CREATE INDEX "FichePaie_annee_mois_idx" ON "FichePaie"("annee", "mois");

-- CreateIndex
CREATE UNIQUE INDEX "FichePaie_profilRHId_mois_annee_key" ON "FichePaie"("profilRHId", "mois", "annee");

-- CreateIndex
CREATE INDEX "ComposantSalaire_fichePaieId_idx" ON "ComposantSalaire"("fichePaieId");

-- CreateIndex
CREATE INDEX "Formation_statut_idx" ON "Formation"("statut");

-- CreateIndex
CREATE INDEX "Formation_dateDebut_idx" ON "Formation"("dateDebut");

-- CreateIndex
CREATE INDEX "ParticipationFormation_profilRHId_idx" ON "ParticipationFormation"("profilRHId");

-- CreateIndex
CREATE INDEX "ParticipationFormation_statut_idx" ON "ParticipationFormation"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationFormation_formationId_profilRHId_key" ON "ParticipationFormation"("formationId", "profilRHId");

-- CreateIndex
CREATE INDEX "Pointage_profilRHId_idx" ON "Pointage"("profilRHId");

-- CreateIndex
CREATE INDEX "Pointage_date_idx" ON "Pointage"("date");

-- CreateIndex
CREATE INDEX "Pointage_statut_idx" ON "Pointage"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Pointage_profilRHId_date_key" ON "Pointage"("profilRHId", "date");

-- CreateIndex
CREATE INDEX "AvantageRH_profilRHId_idx" ON "AvantageRH"("profilRHId");

-- CreateIndex
CREATE INDEX "AvantageRH_actif_idx" ON "AvantageRH"("actif");

-- CreateIndex
CREATE INDEX "RemboursementFrais_profilRHId_idx" ON "RemboursementFrais"("profilRHId");

-- CreateIndex
CREATE INDEX "RemboursementFrais_statut_idx" ON "RemboursementFrais"("statut");

-- CreateIndex
CREATE INDEX "RemboursementFrais_dateFrais_idx" ON "RemboursementFrais"("dateFrais");

-- AddForeignKey
ALTER TABLE "FichePaie" ADD CONSTRAINT "FichePaie_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposantSalaire" ADD CONSTRAINT "ComposantSalaire_fichePaieId_fkey" FOREIGN KEY ("fichePaieId") REFERENCES "FichePaie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationFormation" ADD CONSTRAINT "ParticipationFormation_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationFormation" ADD CONSTRAINT "ParticipationFormation_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvantageRH" ADD CONSTRAINT "AvantageRH_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemboursementFrais" ADD CONSTRAINT "RemboursementFrais_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
