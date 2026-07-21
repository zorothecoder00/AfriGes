-- CreateEnum
CREATE TYPE "TypeDocumentStrategiqueRH" AS ENUM ('MANUEL_RH', 'POLITIQUE_RH', 'REGLEMENT_INTERIEUR', 'CODE_CONDUITE', 'CODE_ETHIQUE', 'POLITIQUE_REMUNERATION', 'POLITIQUE_DISCIPLINAIRE', 'POLITIQUE_RECRUTEMENT', 'POLITIQUE_FORMATION', 'POLITIQUE_PROMOTION', 'POLITIQUE_DIVERSITE', 'POLITIQUE_SANTE_SECURITE', 'POLITIQUE_CONFIDENTIALITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDocumentStrategique" AS ENUM ('BROUILLON', 'EN_VIGUEUR', 'ARCHIVE');

-- CreateTable
CREATE TABLE "DocumentStrategiqueRH" (
    "id" SERIAL NOT NULL,
    "type" "TypeDocumentStrategiqueRH" NOT NULL,
    "titre" TEXT NOT NULL,
    "reference" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "contenu" TEXT,
    "fichierUrl" TEXT,
    "statut" "StatutDocumentStrategique" NOT NULL DEFAULT 'BROUILLON',
    "dateEffet" TIMESTAMP(3),
    "creePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentStrategiqueRH_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentStrategiqueRH_type_idx" ON "DocumentStrategiqueRH"("type");

-- CreateIndex
CREATE INDEX "DocumentStrategiqueRH_statut_idx" ON "DocumentStrategiqueRH"("statut");
