/*
  Warnings:

  - A unique constraint covering the columns `[numero]` on the table `ProfilInvestisseurRIA` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProfilInvestisseurRIA" ADD COLUMN     "numero" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProfilInvestisseurRIA_numero_key" ON "ProfilInvestisseurRIA"("numero");
