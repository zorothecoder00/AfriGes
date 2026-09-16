-- CreateTable
CREATE TABLE "ActionRecouvrementCredit" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "type" "TypeActionRecouvrement" NOT NULL,
    "statut" "StatutActionRecouvrement" NOT NULL DEFAULT 'EN_COURS',
    "notes" TEXT,
    "resultat" TEXT,
    "delaiRegularisationJours" INTEGER,
    "lieuVisite" TEXT,
    "personneRencontree" TEXT,
    "effectueParId" INTEGER,
    "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRelance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRecouvrementCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionRecouvrementCredit_creditId_idx" ON "ActionRecouvrementCredit"("creditId");

-- CreateIndex
CREATE INDEX "ActionRecouvrementCredit_statut_idx" ON "ActionRecouvrementCredit"("statut");

-- CreateIndex
CREATE INDEX "ActionRecouvrementCredit_dateAction_idx" ON "ActionRecouvrementCredit"("dateAction");

-- AddForeignKey
ALTER TABLE "ActionRecouvrementCredit" ADD CONSTRAINT "ActionRecouvrementCredit_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CreditClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionRecouvrementCredit" ADD CONSTRAINT "ActionRecouvrementCredit_effectueParId_fkey" FOREIGN KEY ("effectueParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
