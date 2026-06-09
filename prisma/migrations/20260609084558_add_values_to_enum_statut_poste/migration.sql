-- AlterEnum
ALTER TYPE "StatutPoste" ADD VALUE IF NOT EXISTS 'BROUILLON';

-- AlterEnum
ALTER TYPE "StatutCandidature" ADD VALUE IF NOT EXISTS 'PRE_QUALIFICATION';
ALTER TYPE "StatutCandidature" ADD VALUE IF NOT EXISTS 'TEST';
ALTER TYPE "StatutCandidature" ADD VALUE IF NOT EXISTS 'VALIDATION';
ALTER TYPE "StatutCandidature" ADD VALUE IF NOT EXISTS 'INTEGRATION';

-- AlterTable PosteOuvert
ALTER TABLE "PosteOuvert" ADD COLUMN "reference"      TEXT;
ALTER TABLE "PosteOuvert" ADD COLUMN "lieu"           TEXT;
ALTER TABLE "PosteOuvert" ADD COLUMN "exigences"      TEXT;
ALTER TABLE "PosteOuvert" ADD COLUMN "nbPostes"       INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PosteOuvert" ADD COLUMN "salaireMini"    INTEGER;
ALTER TABLE "PosteOuvert" ADD COLUMN "salaireMaxi"    INTEGER;
ALTER TABLE "PosteOuvert" ADD COLUMN "budgetPoste"    INTEGER;
ALTER TABLE "PosteOuvert" ADD COLUMN "validateurId"   INTEGER;
ALTER TABLE "PosteOuvert" ADD COLUMN "dateValidation" TIMESTAMP(3);

-- AlterTable Candidature
ALTER TABLE "Candidature" ADD COLUMN "scoreCandidat"    INTEGER;
ALTER TABLE "Candidature" ADD COLUMN "noteTest"         DECIMAL(65,30);
ALTER TABLE "Candidature" ADD COLUMN "dateTest"         TIMESTAMP(3);
ALTER TABLE "Candidature" ADD COLUMN "competences"      TEXT;
ALTER TABLE "Candidature" ADD COLUMN "formation"        TEXT;
ALTER TABLE "Candidature" ADD COLUMN "experienceAnnees" INTEGER;
ALTER TABLE "Candidature" ADD COLUMN "sourceCandidat"   TEXT;
ALTER TABLE "Candidature" ADD COLUMN "dateCandidature"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "PosteOuvert_reference_key"   ON "PosteOuvert"("reference");
CREATE INDEX        "PosteOuvert_createdById_idx"  ON "PosteOuvert"("createdById");
