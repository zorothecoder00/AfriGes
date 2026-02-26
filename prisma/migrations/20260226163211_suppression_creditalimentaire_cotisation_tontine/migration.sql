/*
  Warnings:

  - You are about to drop the `Cotisation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Credit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditAlimentaire` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditAlimentaireTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CreditTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tontine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TontineContribution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TontineCycle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TontineMembre` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VenteCreditAlimentaire` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Cotisation" DROP CONSTRAINT "Cotisation_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Cotisation" DROP CONSTRAINT "Cotisation_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Credit" DROP CONSTRAINT "Credit_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Credit" DROP CONSTRAINT "Credit_memberId_fkey";

-- DropForeignKey
ALTER TABLE "CreditAlimentaire" DROP CONSTRAINT "CreditAlimentaire_clientId_fkey";

-- DropForeignKey
ALTER TABLE "CreditAlimentaire" DROP CONSTRAINT "CreditAlimentaire_memberId_fkey";

-- DropForeignKey
ALTER TABLE "CreditAlimentaireTransaction" DROP CONSTRAINT "CreditAlimentaireTransaction_creditId_fkey";

-- DropForeignKey
ALTER TABLE "CreditTransaction" DROP CONSTRAINT "CreditTransaction_creditId_fkey";

-- DropForeignKey
ALTER TABLE "TontineContribution" DROP CONSTRAINT "TontineContribution_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "TontineContribution" DROP CONSTRAINT "TontineContribution_membreId_fkey";

-- DropForeignKey
ALTER TABLE "TontineCycle" DROP CONSTRAINT "TontineCycle_beneficiaireId_fkey";

-- DropForeignKey
ALTER TABLE "TontineCycle" DROP CONSTRAINT "TontineCycle_tontineId_fkey";

-- DropForeignKey
ALTER TABLE "TontineMembre" DROP CONSTRAINT "TontineMembre_clientId_fkey";

-- DropForeignKey
ALTER TABLE "TontineMembre" DROP CONSTRAINT "TontineMembre_memberId_fkey";

-- DropForeignKey
ALTER TABLE "TontineMembre" DROP CONSTRAINT "TontineMembre_tontineId_fkey";

-- DropForeignKey
ALTER TABLE "VenteCreditAlimentaire" DROP CONSTRAINT "VenteCreditAlimentaire_creditAlimentaireId_fkey";

-- DropForeignKey
ALTER TABLE "VenteCreditAlimentaire" DROP CONSTRAINT "VenteCreditAlimentaire_produitId_fkey";

-- DropTable
DROP TABLE "Cotisation";

-- DropTable
DROP TABLE "Credit";

-- DropTable
DROP TABLE "CreditAlimentaire";

-- DropTable
DROP TABLE "CreditAlimentaireTransaction";

-- DropTable
DROP TABLE "CreditTransaction";

-- DropTable
DROP TABLE "Tontine";

-- DropTable
DROP TABLE "TontineContribution";

-- DropTable
DROP TABLE "TontineCycle";

-- DropTable
DROP TABLE "TontineMembre";

-- DropTable
DROP TABLE "VenteCreditAlimentaire";

-- DropEnum
DROP TYPE "Frequence";

-- DropEnum
DROP TYPE "PeriodeCotisation";

-- DropEnum
DROP TYPE "SourceCreditAlim";

-- DropEnum
DROP TYPE "StatutContribution";

-- DropEnum
DROP TYPE "StatutCotisation";

-- DropEnum
DROP TYPE "StatutCredit";

-- DropEnum
DROP TYPE "StatutCreditAlim";

-- DropEnum
DROP TYPE "StatutCycle";

-- DropEnum
DROP TYPE "StatutTontine";

-- DropEnum
DROP TYPE "TransactionCreditType";

-- DropEnum
DROP TYPE "TypeCreditAlim";
