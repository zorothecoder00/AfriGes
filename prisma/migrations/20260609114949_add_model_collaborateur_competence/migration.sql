-- CreateEnum
CREATE TYPE "TypeCompetence" AS ENUM ('HARD_SKILL', 'SOFT_SKILL');

-- CreateEnum
CREATE TYPE "NiveauCompetence" AS ENUM ('DEBUTANT', 'INTERMEDIAIRE', 'AVANCE', 'EXPERT');

-- CreateTable
CREATE TABLE "Competence" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeCompetence" NOT NULL,
    "categorie" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborateurCompetence" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "competenceId" INTEGER NOT NULL,
    "niveau" "NiveauCompetence" NOT NULL,
    "dateAcquisition" TIMESTAMP(3),
    "notes" TEXT,
    "evalueParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborateurCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competence_type_idx" ON "Competence"("type");

-- CreateIndex
CREATE INDEX "Competence_categorie_idx" ON "Competence"("categorie");

-- CreateIndex
CREATE INDEX "Competence_actif_idx" ON "Competence"("actif");

-- CreateIndex
CREATE INDEX "CollaborateurCompetence_profilRHId_idx" ON "CollaborateurCompetence"("profilRHId");

-- CreateIndex
CREATE INDEX "CollaborateurCompetence_competenceId_idx" ON "CollaborateurCompetence"("competenceId");

-- CreateIndex
CREATE INDEX "CollaborateurCompetence_niveau_idx" ON "CollaborateurCompetence"("niveau");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborateurCompetence_profilRHId_competenceId_key" ON "CollaborateurCompetence"("profilRHId", "competenceId");

-- AddForeignKey
ALTER TABLE "CollaborateurCompetence" ADD CONSTRAINT "CollaborateurCompetence_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborateurCompetence" ADD CONSTRAINT "CollaborateurCompetence_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "Competence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
