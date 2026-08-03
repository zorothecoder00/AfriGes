-- CreateEnum
CREATE TYPE "StatutLigneReleve" AS ENUM ('NON_RAPPROCHE', 'RAPPROCHE', 'IGNORE');

-- CreateTable
CREATE TABLE "LigneReleveBancaire" (
    "id" SERIAL NOT NULL,
    "compteNumero" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "libelle" TEXT NOT NULL,
    "reference" TEXT,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutLigneReleve" NOT NULL DEFAULT 'NON_RAPPROCHE',
    "ligneEcritureId" INTEGER,
    "importeParId" INTEGER NOT NULL,
    "importeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneReleveBancaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LigneReleveBancaire_compteNumero_idx" ON "LigneReleveBancaire"("compteNumero");

-- CreateIndex
CREATE INDEX "LigneReleveBancaire_statut_idx" ON "LigneReleveBancaire"("statut");

-- CreateIndex
CREATE INDEX "LigneReleveBancaire_date_idx" ON "LigneReleveBancaire"("date");

-- AddForeignKey
ALTER TABLE "LigneReleveBancaire" ADD CONSTRAINT "LigneReleveBancaire_importeParId_fkey" FOREIGN KEY ("importeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
