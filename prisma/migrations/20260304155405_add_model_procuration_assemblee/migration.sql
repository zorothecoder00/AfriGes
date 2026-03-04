-- CreateEnum
CREATE TYPE "StatutActionnaire" AS ENUM ('ACTIF', 'INACTIF', 'EN_ATTENTE', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "TypeActionDetenue" AS ENUM ('ORDINAIRE', 'PRIVILEGIEE', 'FONDATEUR', 'PREFERENTIELLE');

-- CreateEnum
CREATE TYPE "TypeMouvementAction" AS ENUM ('ACHAT', 'CESSION', 'TRANSFERT_ENTRANT', 'TRANSFERT_SORTANT', 'AJUSTEMENT');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('BILAN', 'COMPTE_RESULTAT', 'RAPPORT_ANNUEL', 'PV_AG', 'CONVOCATION', 'RAPPORT_AUDIT', 'STATUTS', 'PLAN_STRATEGIQUE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutProcuration" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'REVOQUEE');

-- CreateTable
CREATE TABLE "ActionnaireProfile" (
    "id" SERIAL NOT NULL,
    "gestionnaireId" INTEGER NOT NULL,
    "statut" "StatutActionnaire" NOT NULL DEFAULT 'EN_ATTENTE',
    "typeAction" "TypeActionDetenue" NOT NULL DEFAULT 'ORDINAIRE',
    "nombreActions" INTEGER NOT NULL DEFAULT 0,
    "prixUnitaire" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "dateEntree" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionnaireProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementAction" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "type" "TypeMouvementAction" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "montantTotal" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentBibliotheque" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "description" TEXT,
    "fichierUrl" TEXT,
    "fichierNom" TEXT,
    "annee" INTEGER,
    "estPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentBibliotheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurationAssemblee" (
    "id" SERIAL NOT NULL,
    "assembleeId" INTEGER NOT NULL,
    "mandantId" INTEGER NOT NULL,
    "mandataireId" INTEGER NOT NULL,
    "statut" "StatutProcuration" NOT NULL DEFAULT 'EN_ATTENTE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurationAssemblee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionnaireProfile_gestionnaireId_key" ON "ActionnaireProfile"("gestionnaireId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurationAssemblee_assembleeId_mandantId_key" ON "ProcurationAssemblee"("assembleeId", "mandantId");

-- AddForeignKey
ALTER TABLE "ActionnaireProfile" ADD CONSTRAINT "ActionnaireProfile_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementAction" ADD CONSTRAINT "MouvementAction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ActionnaireProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurationAssemblee" ADD CONSTRAINT "ProcurationAssemblee_assembleeId_fkey" FOREIGN KEY ("assembleeId") REFERENCES "Assemblee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurationAssemblee" ADD CONSTRAINT "ProcurationAssemblee_mandantId_fkey" FOREIGN KEY ("mandantId") REFERENCES "Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurationAssemblee" ADD CONSTRAINT "ProcurationAssemblee_mandataireId_fkey" FOREIGN KEY ("mandataireId") REFERENCES "Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
