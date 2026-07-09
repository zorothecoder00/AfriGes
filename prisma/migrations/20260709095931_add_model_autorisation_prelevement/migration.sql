-- CreateTable
CREATE TABLE "AutorisationPrelevement" (
    "id" SERIAL NOT NULL,
    "compteId" INTEGER NOT NULL,
    "creditId" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "montantMax" DECIMAL(65,30),
    "montantMinSolde" DECIMAL(65,30),
    "dernierPrelevementAt" TIMESTAMP(3),
    "totalPreleve" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "nbPrelevements" INTEGER NOT NULL DEFAULT 0,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutorisationPrelevement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutorisationPrelevement_creditId_key" ON "AutorisationPrelevement"("creditId");

-- CreateIndex
CREATE INDEX "AutorisationPrelevement_compteId_idx" ON "AutorisationPrelevement"("compteId");

-- CreateIndex
CREATE INDEX "AutorisationPrelevement_actif_idx" ON "AutorisationPrelevement"("actif");

-- AddForeignKey
ALTER TABLE "AutorisationPrelevement" ADD CONSTRAINT "AutorisationPrelevement_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteCourant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorisationPrelevement" ADD CONSTRAINT "AutorisationPrelevement_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CreditClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorisationPrelevement" ADD CONSTRAINT "AutorisationPrelevement_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
