/*
  Warnings:

  - A unique constraint covering the columns `[clientId]` on the table `CompteComptable` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fournisseurId]` on the table `CompteComptable` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CompteComptable" ADD COLUMN     "clientId" INTEGER,
ADD COLUMN     "fournisseurId" INTEGER;

-- AlterTable
ALTER TABLE "LigneEcriture" ADD COLUMN     "lettrage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CompteComptable_clientId_key" ON "CompteComptable"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CompteComptable_fournisseurId_key" ON "CompteComptable"("fournisseurId");

-- CreateIndex
CREATE INDEX "LigneEcriture_lettrage_idx" ON "LigneEcriture"("lettrage");

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
