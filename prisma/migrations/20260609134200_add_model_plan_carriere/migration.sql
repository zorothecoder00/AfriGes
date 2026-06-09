-- CreateEnum
CREATE TYPE "TypeMouvementCarriere" AS ENUM ('PROMOTION', 'MUTATION', 'EVOLUTION', 'RECLASSEMENT');

-- CreateEnum
CREATE TYPE "NiveauReadiness" AS ENUM ('PRET_MAINTENANT', 'PRET_SOUS_1_AN', 'PRET_1_A_3_ANS', 'EN_DEVELOPPEMENT');

-- AlterTable
ALTER TABLE "HistoriquePoste" ADD COLUMN     "ancienSalaire" DECIMAL(65,30),
ADD COLUMN     "nouveauSalaire" DECIMAL(65,30),
ADD COLUMN     "type" "TypeMouvementCarriere";

-- CreateTable
CREATE TABLE "PlanCarriere" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "aspiration" TEXT,
    "prochainPosteVise" TEXT,
    "dateRevision" TIMESTAMP(3),
    "actions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCarriere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteCritique" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "departement" TEXT,
    "description" TEXT,
    "nbSuccesseursRequis" INTEGER NOT NULL DEFAULT 2,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosteCritique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccesseurPotentiel" (
    "id" SERIAL NOT NULL,
    "posteCritiqueId" INTEGER NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "readiness" "NiveauReadiness" NOT NULL,
    "estTalentCle" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccesseurPotentiel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanCarriere_profilRHId_key" ON "PlanCarriere"("profilRHId");

-- CreateIndex
CREATE INDEX "PosteCritique_actif_idx" ON "PosteCritique"("actif");

-- CreateIndex
CREATE INDEX "SuccesseurPotentiel_posteCritiqueId_idx" ON "SuccesseurPotentiel"("posteCritiqueId");

-- CreateIndex
CREATE INDEX "SuccesseurPotentiel_profilRHId_idx" ON "SuccesseurPotentiel"("profilRHId");

-- CreateIndex
CREATE INDEX "SuccesseurPotentiel_estTalentCle_idx" ON "SuccesseurPotentiel"("estTalentCle");

-- CreateIndex
CREATE UNIQUE INDEX "SuccesseurPotentiel_posteCritiqueId_profilRHId_key" ON "SuccesseurPotentiel"("posteCritiqueId", "profilRHId");

-- CreateIndex
CREATE INDEX "HistoriquePoste_type_idx" ON "HistoriquePoste"("type");

-- AddForeignKey
ALTER TABLE "PlanCarriere" ADD CONSTRAINT "PlanCarriere_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccesseurPotentiel" ADD CONSTRAINT "SuccesseurPotentiel_posteCritiqueId_fkey" FOREIGN KEY ("posteCritiqueId") REFERENCES "PosteCritique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccesseurPotentiel" ADD CONSTRAINT "SuccesseurPotentiel_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
