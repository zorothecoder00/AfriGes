-- CreateEnum
CREATE TYPE "TypeDocumentRIAGenere" AS ENUM ('CONTRAT_INVESTISSEUR', 'RECU_INVESTISSEMENT', 'ATTESTATION_INVESTISSEMENT', 'RELEVE_PORTEFEUILLE', 'RAPPORT_MENSUEL', 'RAPPORT_ANNUEL', 'RAPPORT_RENTABILITE', 'RAPPORT_RISQUE', 'ETAT_CREANCES', 'RAPPORT_FINANCIER');

-- CreateTable
CREATE TABLE "DocumentRIAGenere" (
    "id" SERIAL NOT NULL,
    "type" "TypeDocumentRIAGenere" NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "investisseurId" INTEGER,
    "portefeuilleId" INTEGER,
    "depotId" INTEGER,
    "mois" INTEGER,
    "annee" INTEGER,
    "genereParId" INTEGER NOT NULL,
    "archive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRIAGenere_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRIAGenere_type_idx" ON "DocumentRIAGenere"("type");

-- CreateIndex
CREATE INDEX "DocumentRIAGenere_investisseurId_idx" ON "DocumentRIAGenere"("investisseurId");

-- CreateIndex
CREATE INDEX "DocumentRIAGenere_portefeuilleId_idx" ON "DocumentRIAGenere"("portefeuilleId");

-- CreateIndex
CREATE INDEX "DocumentRIAGenere_createdAt_idx" ON "DocumentRIAGenere"("createdAt");

-- AddForeignKey
ALTER TABLE "DocumentRIAGenere" ADD CONSTRAINT "DocumentRIAGenere_investisseurId_fkey" FOREIGN KEY ("investisseurId") REFERENCES "ProfilInvestisseurRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRIAGenere" ADD CONSTRAINT "DocumentRIAGenere_portefeuilleId_fkey" FOREIGN KEY ("portefeuilleId") REFERENCES "PortefeuilleRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRIAGenere" ADD CONSTRAINT "DocumentRIAGenere_genereParId_fkey" FOREIGN KEY ("genereParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
