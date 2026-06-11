-- CreateEnum
CREATE TYPE "TypeActionRecouvrement" AS ENUM ('APPEL_TELEPHONIQUE', 'VISITE_TERRAIN', 'MISE_EN_DEMEURE', 'ACCORD_ECHEANCIER', 'SAISIE_GARANTIE', 'NOTE_INTERNE');

-- CreateEnum
CREATE TYPE "StatutActionRecouvrement" AS ENUM ('EN_COURS', 'RESOLU', 'SANS_SUITE');

-- CreateTable
CREATE TABLE "ActionRecouvrementRIA" (
    "id" SERIAL NOT NULL,
    "financementId" INTEGER NOT NULL,
    "type" "TypeActionRecouvrement" NOT NULL,
    "statut" "StatutActionRecouvrement" NOT NULL DEFAULT 'EN_COURS',
    "notes" TEXT,
    "resultat" TEXT,
    "effectueParId" INTEGER,
    "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRelance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRecouvrementRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionRecouvrementRIA_financementId_idx" ON "ActionRecouvrementRIA"("financementId");

-- CreateIndex
CREATE INDEX "ActionRecouvrementRIA_statut_idx" ON "ActionRecouvrementRIA"("statut");

-- CreateIndex
CREATE INDEX "ActionRecouvrementRIA_dateAction_idx" ON "ActionRecouvrementRIA"("dateAction");

-- AddForeignKey
ALTER TABLE "ActionRecouvrementRIA" ADD CONSTRAINT "ActionRecouvrementRIA_financementId_fkey" FOREIGN KEY ("financementId") REFERENCES "OperationFinancementRIA"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRecouvrementRIA" ADD CONSTRAINT "ActionRecouvrementRIA_effectueParId_fkey" FOREIGN KEY ("effectueParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
