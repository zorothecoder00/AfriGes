-- CreateEnum
CREATE TYPE "StatutCollaborateur" AS ENUM ('ACTIF', 'EN_PERIODE_ESSAI', 'SUSPENDU', 'DEMISSIONNAIRE', 'LICENCIE', 'RETRAITE', 'INACTIF');

-- CreateEnum
CREATE TYPE "TypeContrat" AS ENUM ('CDI', 'CDD', 'STAGE', 'CONSULTANT', 'PRESTATAIRE', 'FREELANCE');

-- CreateEnum
CREATE TYPE "SituationMatrimoniale" AS ENUM ('CELIBATAIRE', 'MARIE', 'DIVORCE', 'VEUF', 'UNION_LIBRE');

-- CreateEnum
CREATE TYPE "NiveauHierarchique" AS ENUM ('DIRECTION', 'MANAGER', 'SUPERVISEUR', 'AGENT', 'STAGIAIRE');

-- CreateEnum
CREATE TYPE "TypeDocumentCollaborateur" AS ENUM ('CNI', 'PASSEPORT', 'DIPLOME', 'CERTIFICAT', 'CV', 'ATTESTATION', 'CONTRAT', 'PHOTO_IDENTITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeConge" AS ENUM ('ANNUEL', 'MALADIE', 'EXCEPTIONNEL', 'PERMISSION', 'FORMATION', 'MATERNITE', 'PATERNITE', 'SANS_SOLDE');

-- CreateEnum
CREATE TYPE "StatutDemandeConge" AS ENUM ('EN_ATTENTE', 'VALIDE_MANAGER', 'VALIDE_RH', 'APPROUVE', 'REJETE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutMission" AS ENUM ('CREE', 'VALIDE', 'EN_COURS', 'CLOTURE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeDocumentRHGenere" AS ENUM ('ATTESTATION_TRAVAIL', 'CERTIFICAT_PRESENCE', 'DECISION_AFFECTATION', 'LETTRE_MISSION', 'AUTRE');

-- AlterEnum
ALTER TYPE "RoleGestionnaire" ADD VALUE 'RESPONSABLE_RH';

-- CreateTable
CREATE TABLE "ProfilRH" (
    "id" SERIAL NOT NULL,
    "gestionnaireId" INTEGER NOT NULL,
    "matricule" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3),
    "lieuNaissance" TEXT,
    "sexe" "Sexe",
    "nationalite" TEXT,
    "situationMatrimoniale" "SituationMatrimoniale",
    "nbEnfants" INTEGER NOT NULL DEFAULT 0,
    "telephoneSecondaire" TEXT,
    "typeContrat" "TypeContrat",
    "dateEmbauche" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "fonction" TEXT,
    "service" TEXT,
    "departement" TEXT,
    "niveauHierarchique" "NiveauHierarchique",
    "statut" "StatutCollaborateur" NOT NULL DEFAULT 'ACTIF',
    "notes" TEXT,
    "managerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilRH_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCollaborateur" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeDocumentCollaborateur" NOT NULL,
    "nom" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "uploadePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCollaborateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolitiqueConge" (
    "id" SERIAL NOT NULL,
    "type" "TypeConge" NOT NULL,
    "joursParAn" INTEGER NOT NULL DEFAULT 0,
    "reportable" BOOLEAN NOT NULL DEFAULT false,
    "joursMaxReport" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolitiqueConge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoldeConge" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeConge" NOT NULL,
    "annee" INTEGER NOT NULL,
    "totalDroit" INTEGER NOT NULL DEFAULT 0,
    "pris" INTEGER NOT NULL DEFAULT 0,
    "reporte" INTEGER NOT NULL DEFAULT 0,
    "restant" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SoldeConge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeConge" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeConge" NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "nbJours" INTEGER NOT NULL,
    "motif" TEXT,
    "statut" "StatutDemandeConge" NOT NULL DEFAULT 'EN_ATTENTE',
    "managerId" INTEGER,
    "rhId" INTEGER,
    "commentaireRefus" TEXT,
    "dateValidationMgr" TIMESTAMP(3),
    "dateValidationRH" TIMESTAMP(3),
    "dateDecisionFinale" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeConge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "objectifs" TEXT,
    "livrables" TEXT,
    "destination" TEXT,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "dateRetour" TIMESTAMP(3),
    "dateRetourReel" TIMESTAMP(3),
    "statut" "StatutMission" NOT NULL DEFAULT 'CREE',
    "rapport" TEXT,
    "notes" TEXT,
    "collaborateurId" INTEGER NOT NULL,
    "valideParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRHGenere" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "type" "TypeDocumentRHGenere" NOT NULL,
    "titre" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileUrl" TEXT,
    "generePar" INTEGER NOT NULL,
    "notes" TEXT,
    "archive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRHGenere_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfilRH_gestionnaireId_key" ON "ProfilRH"("gestionnaireId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilRH_matricule_key" ON "ProfilRH"("matricule");

-- CreateIndex
CREATE INDEX "ProfilRH_statut_idx" ON "ProfilRH"("statut");

-- CreateIndex
CREATE INDEX "ProfilRH_departement_idx" ON "ProfilRH"("departement");

-- CreateIndex
CREATE INDEX "ProfilRH_managerId_idx" ON "ProfilRH"("managerId");

-- CreateIndex
CREATE INDEX "DocumentCollaborateur_profilRHId_idx" ON "DocumentCollaborateur"("profilRHId");

-- CreateIndex
CREATE INDEX "DocumentCollaborateur_type_idx" ON "DocumentCollaborateur"("type");

-- CreateIndex
CREATE UNIQUE INDEX "PolitiqueConge_type_key" ON "PolitiqueConge"("type");

-- CreateIndex
CREATE INDEX "SoldeConge_profilRHId_idx" ON "SoldeConge"("profilRHId");

-- CreateIndex
CREATE UNIQUE INDEX "SoldeConge_profilRHId_type_annee_key" ON "SoldeConge"("profilRHId", "type", "annee");

-- CreateIndex
CREATE INDEX "DemandeConge_profilRHId_idx" ON "DemandeConge"("profilRHId");

-- CreateIndex
CREATE INDEX "DemandeConge_statut_idx" ON "DemandeConge"("statut");

-- CreateIndex
CREATE INDEX "DemandeConge_dateDebut_dateFin_idx" ON "DemandeConge"("dateDebut", "dateFin");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_reference_key" ON "Mission"("reference");

-- CreateIndex
CREATE INDEX "Mission_collaborateurId_idx" ON "Mission"("collaborateurId");

-- CreateIndex
CREATE INDEX "Mission_statut_idx" ON "Mission"("statut");

-- CreateIndex
CREATE INDEX "Mission_dateDepart_idx" ON "Mission"("dateDepart");

-- CreateIndex
CREATE INDEX "DocumentRHGenere_profilRHId_idx" ON "DocumentRHGenere"("profilRHId");

-- CreateIndex
CREATE INDEX "DocumentRHGenere_type_idx" ON "DocumentRHGenere"("type");

-- AddForeignKey
ALTER TABLE "ProfilRH" ADD CONSTRAINT "ProfilRH_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "ProfilRH"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilRH" ADD CONSTRAINT "ProfilRH_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCollaborateur" ADD CONSTRAINT "DocumentCollaborateur_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldeConge" ADD CONSTRAINT "SoldeConge_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeConge" ADD CONSTRAINT "DemandeConge_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_collaborateurId_fkey" FOREIGN KEY ("collaborateurId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "ProfilRH"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRHGenere" ADD CONSTRAINT "DocumentRHGenere_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
