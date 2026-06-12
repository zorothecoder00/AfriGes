-- CreateEnum
CREATE TYPE "TypeCommissionRIA" AS ENUM ('FINANCE', 'OPERATIONS_TERRAIN', 'AUDIT', 'OPTIMISATION');

-- CreateEnum
CREATE TYPE "RoleMembreCommissionRIA" AS ENUM ('PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE', 'TRESORIER', 'MEMBRE');

-- CreateEnum
CREATE TYPE "StatutReunionCommissionRIA" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TENUE', 'ANNULEE', 'REPORTEE');

-- CreateEnum
CREATE TYPE "StatutResolutionRIA" AS ENUM ('EN_ATTENTE', 'APPROUVEE', 'REJETEE', 'EN_APPLICATION', 'APPLIQUEE');

-- CreateEnum
CREATE TYPE "StatutPlanActionCommRIA" AS ENUM ('A_FAIRE', 'EN_COURS', 'TERMINE', 'ABANDONNE');

-- CreateEnum
CREATE TYPE "PrioriteActionRIA" AS ENUM ('CRITIQUE', 'HAUTE', 'MOYENNE', 'BASSE');

-- CreateTable
CREATE TABLE "MembreCommissionRIA" (
    "id" SERIAL NOT NULL,
    "typeCommission" "TypeCommissionRIA" NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "RoleMembreCommissionRIA" NOT NULL DEFAULT 'MEMBRE',
    "dateEntree" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateSortie" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembreCommissionRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReunionCommissionRIA" (
    "id" SERIAL NOT NULL,
    "typeCommission" "TypeCommissionRIA" NOT NULL,
    "titre" TEXT NOT NULL,
    "dateHeure" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT,
    "ordreJour" TEXT,
    "statut" "StatutReunionCommissionRIA" NOT NULL DEFAULT 'PLANIFIEE',
    "compteRendu" TEXT,
    "organisateurId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReunionCommissionRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceReunionRIA" (
    "id" SERIAL NOT NULL,
    "reunionId" INTEGER NOT NULL,
    "membreId" INTEGER NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "procuration" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "PresenceReunionRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionCommRIA" (
    "id" SERIAL NOT NULL,
    "reunionId" INTEGER,
    "typeCommission" "TypeCommissionRIA" NOT NULL,
    "numero" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "statut" "StatutResolutionRIA" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateEcheance" TIMESTAMP(3),
    "responsableId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionCommRIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanActionCommRIA" (
    "id" SERIAL NOT NULL,
    "resolutionId" INTEGER,
    "typeCommission" "TypeCommissionRIA" NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "priorite" "PrioriteActionRIA" NOT NULL DEFAULT 'MOYENNE',
    "statut" "StatutPlanActionCommRIA" NOT NULL DEFAULT 'A_FAIRE',
    "responsableId" INTEGER,
    "dateDebut" TIMESTAMP(3),
    "dateEcheance" TIMESTAMP(3),
    "dateTermine" TIMESTAMP(3),
    "progression" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanActionCommRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembreCommissionRIA_typeCommission_idx" ON "MembreCommissionRIA"("typeCommission");

-- CreateIndex
CREATE INDEX "MembreCommissionRIA_userId_idx" ON "MembreCommissionRIA"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MembreCommissionRIA_typeCommission_userId_key" ON "MembreCommissionRIA"("typeCommission", "userId");

-- CreateIndex
CREATE INDEX "ReunionCommissionRIA_typeCommission_idx" ON "ReunionCommissionRIA"("typeCommission");

-- CreateIndex
CREATE INDEX "ReunionCommissionRIA_statut_idx" ON "ReunionCommissionRIA"("statut");

-- CreateIndex
CREATE INDEX "ReunionCommissionRIA_dateHeure_idx" ON "ReunionCommissionRIA"("dateHeure");

-- CreateIndex
CREATE INDEX "PresenceReunionRIA_reunionId_idx" ON "PresenceReunionRIA"("reunionId");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceReunionRIA_reunionId_membreId_key" ON "PresenceReunionRIA"("reunionId", "membreId");

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionCommRIA_numero_key" ON "ResolutionCommRIA"("numero");

-- CreateIndex
CREATE INDEX "ResolutionCommRIA_typeCommission_idx" ON "ResolutionCommRIA"("typeCommission");

-- CreateIndex
CREATE INDEX "ResolutionCommRIA_statut_idx" ON "ResolutionCommRIA"("statut");

-- CreateIndex
CREATE INDEX "PlanActionCommRIA_typeCommission_idx" ON "PlanActionCommRIA"("typeCommission");

-- CreateIndex
CREATE INDEX "PlanActionCommRIA_statut_idx" ON "PlanActionCommRIA"("statut");

-- CreateIndex
CREATE INDEX "PlanActionCommRIA_priorite_idx" ON "PlanActionCommRIA"("priorite");

-- AddForeignKey
ALTER TABLE "MembreCommissionRIA" ADD CONSTRAINT "MembreCommissionRIA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReunionCommissionRIA" ADD CONSTRAINT "ReunionCommissionRIA_organisateurId_fkey" FOREIGN KEY ("organisateurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceReunionRIA" ADD CONSTRAINT "PresenceReunionRIA_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionCommissionRIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceReunionRIA" ADD CONSTRAINT "PresenceReunionRIA_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "MembreCommissionRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionCommRIA" ADD CONSTRAINT "ResolutionCommRIA_reunionId_fkey" FOREIGN KEY ("reunionId") REFERENCES "ReunionCommissionRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionCommRIA" ADD CONSTRAINT "ResolutionCommRIA_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanActionCommRIA" ADD CONSTRAINT "PlanActionCommRIA_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "ResolutionCommRIA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanActionCommRIA" ADD CONSTRAINT "PlanActionCommRIA_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
