-- AlterTable
ALTER TABLE "ConfigurationComptableInitiale" ADD COLUMN     "referentielActifId" INTEGER;

-- CreateTable
CREATE TABLE "ReferentielComptable" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "pays" TEXT NOT NULL,
    "dateApplication" TIMESTAMP(3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferentielComptable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferentielComptable_code_key" ON "ReferentielComptable"("code");

-- AddForeignKey
ALTER TABLE "ConfigurationComptableInitiale" ADD CONSTRAINT "ConfigurationComptableInitiale_referentielActifId_fkey" FOREIGN KEY ("referentielActifId") REFERENCES "ReferentielComptable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
