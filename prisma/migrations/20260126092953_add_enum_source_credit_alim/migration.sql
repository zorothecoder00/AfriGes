/*
  Warnings:

  - Added the required column `sourceId` to the `CreditAlimentaire` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SourceCreditAlim" AS ENUM ('COTISATION', 'TONTINE');

-- AlterTable
ALTER TABLE "CreditAlimentaire" ADD COLUMN     "source" "SourceCreditAlim" NOT NULL DEFAULT 'COTISATION',
ADD COLUMN     "sourceId" INTEGER NOT NULL;
