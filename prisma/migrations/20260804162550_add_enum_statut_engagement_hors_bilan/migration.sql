-- CreateEnum
CREATE TYPE "TypeEngagementHorsBilan" AS ENUM ('CAUTION_DONNEE', 'CAUTION_RECUE', 'GARANTIE_DONNEE', 'GARANTIE_RECUE', 'CREDIT_BAIL', 'LITIGE_EN_COURS', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutEngagementHorsBilan" AS ENUM ('ACTIF', 'LEVE');

-- CreateTable
CREATE TABLE "EngagementHorsBilan" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TypeEngagementHorsBilan" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "beneficiaire" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "statut" "StatutEngagementHorsBilan" NOT NULL DEFAULT 'ACTIF',
    "dateLevee" TIMESTAMP(3),
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementHorsBilan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngagementHorsBilan_reference_key" ON "EngagementHorsBilan"("reference");

-- CreateIndex
CREATE INDEX "EngagementHorsBilan_statut_idx" ON "EngagementHorsBilan"("statut");

-- CreateIndex
CREATE INDEX "EngagementHorsBilan_type_idx" ON "EngagementHorsBilan"("type");

-- AddForeignKey
ALTER TABLE "EngagementHorsBilan" ADD CONSTRAINT "EngagementHorsBilan_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
