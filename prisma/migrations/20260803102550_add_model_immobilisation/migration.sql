-- CreateEnum
CREATE TYPE "CategorieImmobilisation" AS ENUM ('TERRAIN', 'BATIMENT', 'MATERIEL_MOBILIER', 'MATERIEL_TRANSPORT', 'MATERIEL_INFORMATIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutImmobilisation" AS ENUM ('EN_SERVICE', 'AMORTIE', 'CEDEE', 'HORS_SERVICE');

-- CreateEnum
CREATE TYPE "MethodeAmortissement" AS ENUM ('LINEAIRE', 'DEGRESSIF');

-- CreateTable
CREATE TABLE "Immobilisation" (
    "id" SERIAL NOT NULL,
    "numeroInventaire" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "categorie" "CategorieImmobilisation" NOT NULL,
    "compteId" INTEGER NOT NULL,
    "compteAmortissementId" INTEGER NOT NULL,
    "fournisseurId" INTEGER,
    "dateAcquisition" TIMESTAMP(3) NOT NULL,
    "dateMiseEnService" TIMESTAMP(3) NOT NULL,
    "coutAcquisition" DECIMAL(65,30) NOT NULL,
    "valeurResiduelle" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dureeAnnees" INTEGER NOT NULL,
    "methode" "MethodeAmortissement" NOT NULL DEFAULT 'LINEAIRE',
    "amortissementCumule" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "valeurNetteComptable" DECIMAL(65,30) NOT NULL,
    "localisation" TEXT,
    "responsableId" INTEGER,
    "numeroSerie" TEXT,
    "notes" TEXT,
    "statut" "StatutImmobilisation" NOT NULL DEFAULT 'EN_SERVICE',
    "dateCession" TIMESTAMP(3),
    "prixCession" DECIMAL(65,30),
    "ecritureAcquisitionId" INTEGER,
    "creePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Immobilisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneAmortissement" (
    "id" SERIAL NOT NULL,
    "immobilisationId" INTEGER NOT NULL,
    "periode" TEXT NOT NULL,
    "montantDotation" DECIMAL(65,30) NOT NULL,
    "cumulApres" DECIMAL(65,30) NOT NULL,
    "vncApres" DECIMAL(65,30) NOT NULL,
    "ecritureId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneAmortissement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Immobilisation_numeroInventaire_key" ON "Immobilisation"("numeroInventaire");

-- CreateIndex
CREATE INDEX "Immobilisation_categorie_idx" ON "Immobilisation"("categorie");

-- CreateIndex
CREATE INDEX "Immobilisation_statut_idx" ON "Immobilisation"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "LigneAmortissement_immobilisationId_periode_key" ON "LigneAmortissement"("immobilisationId", "periode");

-- AddForeignKey
ALTER TABLE "Immobilisation" ADD CONSTRAINT "Immobilisation_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immobilisation" ADD CONSTRAINT "Immobilisation_compteAmortissementId_fkey" FOREIGN KEY ("compteAmortissementId") REFERENCES "CompteComptable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immobilisation" ADD CONSTRAINT "Immobilisation_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immobilisation" ADD CONSTRAINT "Immobilisation_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immobilisation" ADD CONSTRAINT "Immobilisation_creePar_fkey" FOREIGN KEY ("creePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneAmortissement" ADD CONSTRAINT "LigneAmortissement_immobilisationId_fkey" FOREIGN KEY ("immobilisationId") REFERENCES "Immobilisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
