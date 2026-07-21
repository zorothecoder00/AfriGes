-- CreateEnum
CREATE TYPE "TypeDocumentRecrutement" AS ENUM ('AVIS_RECRUTEMENT', 'CONVOCATION_ENTRETIEN', 'LETTRE_OFFRE', 'LETTRE_REFUS', 'PROMESSE_EMBAUCHE', 'PV_SELECTION');

-- CreateTable
CREATE TABLE "DocumentRecrutementGenere" (
    "id" SERIAL NOT NULL,
    "type" "TypeDocumentRecrutement" NOT NULL,
    "titre" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contenu" TEXT,
    "fileUrl" TEXT,
    "generePar" INTEGER NOT NULL,
    "notes" TEXT,
    "archive" BOOLEAN NOT NULL DEFAULT false,
    "posteId" INTEGER,
    "candidatureId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRecrutementGenere_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRecrutementGenere_posteId_idx" ON "DocumentRecrutementGenere"("posteId");

-- CreateIndex
CREATE INDEX "DocumentRecrutementGenere_candidatureId_idx" ON "DocumentRecrutementGenere"("candidatureId");

-- CreateIndex
CREATE INDEX "DocumentRecrutementGenere_type_idx" ON "DocumentRecrutementGenere"("type");

-- AddForeignKey
ALTER TABLE "DocumentRecrutementGenere" ADD CONSTRAINT "DocumentRecrutementGenere_posteId_fkey" FOREIGN KEY ("posteId") REFERENCES "PosteOuvert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecrutementGenere" ADD CONSTRAINT "DocumentRecrutementGenere_candidatureId_fkey" FOREIGN KEY ("candidatureId") REFERENCES "Candidature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
