-- CreateTable
CREATE TABLE "FactureAchat" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "dateFacture" TIMESTAMP(3) NOT NULL,
    "fournisseurId" INTEGER NOT NULL,
    "montantTTC" DECIMAL(65,30) NOT NULL,
    "receptionApproId" INTEGER,
    "statutRapprochement" TEXT NOT NULL DEFAULT 'NON_RAPPROCHEE',
    "dateRapprochement" TIMESTAMP(3),
    "rapprocheParId" INTEGER,
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactureAchat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactureAchat_fournisseurId_idx" ON "FactureAchat"("fournisseurId");

-- CreateIndex
CREATE INDEX "FactureAchat_statutRapprochement_idx" ON "FactureAchat"("statutRapprochement");

-- AddForeignKey
ALTER TABLE "FactureAchat" ADD CONSTRAINT "FactureAchat_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureAchat" ADD CONSTRAINT "FactureAchat_receptionApproId_fkey" FOREIGN KEY ("receptionApproId") REFERENCES "ReceptionApprovisionnement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureAchat" ADD CONSTRAINT "FactureAchat_rapprocheParId_fkey" FOREIGN KEY ("rapprocheParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactureAchat" ADD CONSTRAINT "FactureAchat_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
