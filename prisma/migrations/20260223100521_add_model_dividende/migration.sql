-- CreateEnum
CREATE TYPE "StatutDividende" AS ENUM ('PLANIFIE', 'EN_COURS', 'VERSE', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeAssemblee" AS ENUM ('AGO', 'AGE', 'CS', 'CA');

-- CreateEnum
CREATE TYPE "StatutAssemblee" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutParticipation" AS ENUM ('INVITE', 'CONFIRME', 'ABSENT', 'PRESENT');

-- CreateEnum
CREATE TYPE "StatutResolution" AS ENUM ('EN_ATTENTE', 'APPROUVEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "DecisionVote" AS ENUM ('POUR', 'CONTRE', 'ABSTENTION');

-- CreateTable
CREATE TABLE "Dividende" (
    "id" SERIAL NOT NULL,
    "periode" TEXT NOT NULL,
    "montantTotal" DECIMAL(65,30) NOT NULL,
    "montantParPart" DECIMAL(65,30),
    "dateVersement" TIMESTAMP(3),
    "statut" "StatutDividende" NOT NULL DEFAULT 'PLANIFIE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dividende_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assemblee" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeAssemblee" NOT NULL,
    "statut" "StatutAssemblee" NOT NULL DEFAULT 'PLANIFIEE',
    "dateAssemblee" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT NOT NULL,
    "ordreJour" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assemblee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssembleeParticipant" (
    "id" SERIAL NOT NULL,
    "assembleeId" INTEGER NOT NULL,
    "gestionnaireId" INTEGER NOT NULL,
    "statut" "StatutParticipation" NOT NULL DEFAULT 'INVITE',
    "dateConfirmation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssembleeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionAssemblee" (
    "id" SERIAL NOT NULL,
    "assembleeId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "statut" "StatutResolution" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionAssemblee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteAssemblee" (
    "id" SERIAL NOT NULL,
    "resolutionId" INTEGER NOT NULL,
    "participantId" INTEGER NOT NULL,
    "decision" "DecisionVote" NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteAssemblee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssembleeParticipant_assembleeId_gestionnaireId_key" ON "AssembleeParticipant"("assembleeId", "gestionnaireId");

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionAssemblee_assembleeId_numero_key" ON "ResolutionAssemblee"("assembleeId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "VoteAssemblee_resolutionId_participantId_key" ON "VoteAssemblee"("resolutionId", "participantId");

-- AddForeignKey
ALTER TABLE "AssembleeParticipant" ADD CONSTRAINT "AssembleeParticipant_assembleeId_fkey" FOREIGN KEY ("assembleeId") REFERENCES "Assemblee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssembleeParticipant" ADD CONSTRAINT "AssembleeParticipant_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionAssemblee" ADD CONSTRAINT "ResolutionAssemblee_assembleeId_fkey" FOREIGN KEY ("assembleeId") REFERENCES "Assemblee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteAssemblee" ADD CONSTRAINT "VoteAssemblee_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "ResolutionAssemblee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteAssemblee" ADD CONSTRAINT "VoteAssemblee_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "AssembleeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
