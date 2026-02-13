/*
  Warnings:

  - A unique constraint covering the columns `[tontineId,clientId]` on the table `TontineMembre` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Cotisation" DROP CONSTRAINT "Cotisation_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Credit" DROP CONSTRAINT "Credit_memberId_fkey";

-- DropForeignKey
ALTER TABLE "CreditAlimentaire" DROP CONSTRAINT "CreditAlimentaire_memberId_fkey";

-- DropForeignKey
ALTER TABLE "TontineMembre" DROP CONSTRAINT "TontineMembre_memberId_fkey";

-- DropIndex
DROP INDEX "TontineMembre_tontineId_memberId_key";

-- AlterTable
ALTER TABLE "Cotisation" ALTER COLUMN "memberId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Credit" ALTER COLUMN "memberId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CreditAlimentaire" ALTER COLUMN "memberId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TontineMembre" ALTER COLUMN "memberId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TontineMembre_tontineId_clientId_key" ON "TontineMembre"("tontineId", "clientId");

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineMembre" ADD CONSTRAINT "TontineMembre_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAlimentaire" ADD CONSTRAINT "CreditAlimentaire_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
