-- Conversion enum -> texte SANS perte de données : un enum Postgres se caste
-- nativement en texte (ex. 'CAISSE'::"TypeJournalComptable" -> 'CAISSE'::text),
-- contrairement au DROP COLUMN/ADD COLUMN généré par défaut par Prisma (qui
-- aurait détruit les valeurs existantes, colonne NOT NULL sans défaut).
-- AlterTable
ALTER TABLE "EcritureComptable" ALTER COLUMN "journal" TYPE TEXT USING "journal"::text;

-- AlterTable
ALTER TABLE "EcritureRecurrente" ALTER COLUMN "journal" TYPE TEXT USING "journal"::text;

-- AlterTable
ALTER TABLE "RegleComptable" ALTER COLUMN "journal" TYPE TEXT USING "journal"::text;

-- DropEnum
DROP TYPE "TypeJournalComptable";

-- CreateTable
CREATE TABLE "JournalComptable" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "prefixe" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalComptable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalComptable_code_key" ON "JournalComptable"("code");

-- Note : l'index "EcritureComptable_journal_idx" existe déjà (créé avec la
-- colonne enum d'origine) — ALTER COLUMN TYPE le préserve, pas besoin de le recréer.
