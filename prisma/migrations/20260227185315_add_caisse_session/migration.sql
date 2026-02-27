-- CreateEnum
CREATE TYPE "StatutSessionCaisse" AS ENUM ('OUVERTE', 'SUSPENDUE', 'FERMEE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'VIREMENT', 'CHEQUE');

-- CreateEnum
CREATE TYPE "TypeOperationCaisse" AS ENUM ('ENCAISSEMENT', 'DECAISSEMENT');

-- CreateEnum
CREATE TYPE "CategorieDecaissement" AS ENUM ('SALAIRE', 'AVANCE', 'FOURNISSEUR', 'AUTRE');

-- AlterTable
ALTER TABLE "ClotureCaisse" ADD COLUMN     "ecart" DECIMAL(65,30),
ADD COLUMN     "fondsCaisse" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "sessionId" INTEGER,
ADD COLUMN     "soldeReel" DECIMAL(65,30),
ADD COLUMN     "soldeTheorique" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "totalDecaissements" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "totalEncaissementsAutres" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTransferts" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SessionCaisse" (
    "id" SERIAL NOT NULL,
    "caissierNom" TEXT NOT NULL,
    "caissierId" INTEGER NOT NULL,
    "fondsCaisse" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statut" "StatutSessionCaisse" NOT NULL DEFAULT 'OUVERTE',
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFermeture" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationCaisse" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "type" "TypeOperationCaisse" NOT NULL,
    "mode" "ModePaiement",
    "categorie" "CategorieDecaissement",
    "montant" DECIMAL(65,30) NOT NULL,
    "motif" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "pieceJointe" TEXT,
    "operateurNom" TEXT NOT NULL,
    "operateurId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransfertCaisse" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "origine" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "motif" TEXT,
    "reference" TEXT NOT NULL,
    "operateurNom" TEXT NOT NULL,
    "operateurId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransfertCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationCaisse_reference_key" ON "OperationCaisse"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "TransfertCaisse_reference_key" ON "TransfertCaisse"("reference");

-- AddForeignKey
ALTER TABLE "OperationCaisse" ADD CONSTRAINT "OperationCaisse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SessionCaisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransfertCaisse" ADD CONSTRAINT "TransfertCaisse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SessionCaisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClotureCaisse" ADD CONSTRAINT "ClotureCaisse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SessionCaisse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
