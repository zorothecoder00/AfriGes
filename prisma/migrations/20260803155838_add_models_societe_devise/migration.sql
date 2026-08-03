-- AlterTable
ALTER TABLE "EcritureComptable" ADD COLUMN     "devise" TEXT NOT NULL DEFAULT 'XOF',
ADD COLUMN     "societeId" INTEGER,
ADD COLUMN     "tauxChange" DECIMAL(65,30) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ExerciceComptable" ADD COLUMN     "societeId" INTEGER;

-- AlterTable
ALTER TABLE "JournalComptable" ADD COLUMN     "societeId" INTEGER;

-- CreateTable
CREATE TABLE "Devise" (
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "symbole" TEXT NOT NULL,
    "tauxVersFonctionnelle" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "dateTauxMaj" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devise_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Societe" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "pays" TEXT NOT NULL DEFAULT 'Togo',
    "deviseFonctionnelleCode" TEXT NOT NULL DEFAULT 'XOF',
    "referentielComptable" TEXT NOT NULL DEFAULT 'SYSCOHADA révisé',
    "typeEntite" TEXT NOT NULL DEFAULT 'Société commerciale',
    "estPrincipale" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Societe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Societe_estPrincipale_idx" ON "Societe"("estPrincipale");

-- CreateIndex
CREATE INDEX "EcritureComptable_societeId_idx" ON "EcritureComptable"("societeId");

-- CreateIndex
CREATE INDEX "ExerciceComptable_societeId_idx" ON "ExerciceComptable"("societeId");

-- CreateIndex
CREATE INDEX "JournalComptable_societeId_idx" ON "JournalComptable"("societeId");

-- AddForeignKey
ALTER TABLE "JournalComptable" ADD CONSTRAINT "JournalComptable_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcritureComptable" ADD CONSTRAINT "EcritureComptable_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciceComptable" ADD CONSTRAINT "ExerciceComptable_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
