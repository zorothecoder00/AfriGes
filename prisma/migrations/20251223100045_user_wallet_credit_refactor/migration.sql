/*
  Warnings:

  - The values [JOURNALIER] on the enum `Frequence` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dateCotisation` on the `Cotisation` table. All the data in the column will be lost.
  - You are about to drop the column `modePaiement` on the `Cotisation` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `Cotisation` table. All the data in the column will be lost.
  - You are about to drop the column `tontineMembreId` on the `Cotisation` table. All the data in the column will be lost.
  - You are about to alter the column `montant` on the `Cotisation` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `BigInt`.
  - You are about to drop the column `dateTransaction` on the `CreditTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `dateCreation` on the `Tontine` table. All the data in the column will be lost.
  - You are about to drop the column `montantCotisation` on the `Tontine` table. All the data in the column will be lost.
  - You are about to drop the `Member` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `dateExpiration` to the `Cotisation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `datePaiement` to the `Cotisation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `memberId` to the `Cotisation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `periode` to the `Cotisation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Cotisation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Credit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CreditTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateDebut` to the `Tontine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montantCycle` to the `Tontine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Tontine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `WalletTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PeriodeCotisation" AS ENUM ('MENSUEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "StatutCotisation" AS ENUM ('EN_ATTENTE', 'PAYEE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "StatutCreditAlim" AS ENUM ('ACTIF', 'EPUISE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "TypeCreditAlim" AS ENUM ('UTILISATION', 'ANNULATION', 'AJUSTEMENT');

-- AlterEnum
BEGIN;
CREATE TYPE "Frequence_new" AS ENUM ('HEBDOMADAIRE', 'MENSUEL');
ALTER TABLE "Tontine" ALTER COLUMN "frequence" TYPE "Frequence_new" USING ("frequence"::text::"Frequence_new");
ALTER TYPE "Frequence" RENAME TO "Frequence_old";
ALTER TYPE "Frequence_new" RENAME TO "Frequence";
DROP TYPE "public"."Frequence_old";
COMMIT;

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'CREDIT';

-- DropForeignKey
ALTER TABLE "Cotisation" DROP CONSTRAINT "Cotisation_tontineMembreId_fkey";

-- DropForeignKey
ALTER TABLE "Credit" DROP CONSTRAINT "Credit_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Gestionnaire" DROP CONSTRAINT "Gestionnaire_memberId_fkey";

-- DropForeignKey
ALTER TABLE "TontineMembre" DROP CONSTRAINT "TontineMembre_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_memberId_fkey";

-- DropIndex
DROP INDEX "Cotisation_reference_key";

-- AlterTable
ALTER TABLE "Cotisation" DROP COLUMN "dateCotisation",
DROP COLUMN "modePaiement",
DROP COLUMN "reference",
DROP COLUMN "tontineMembreId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateExpiration" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "datePaiement" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "memberId" INTEGER NOT NULL,
ADD COLUMN     "periode" "PeriodeCotisation" NOT NULL,
ADD COLUMN     "statut" "StatutCotisation" NOT NULL DEFAULT 'EN_ATTENTE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "montant" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Credit" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CreditTransaction" DROP COLUMN "dateTransaction",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Tontine" DROP COLUMN "dateCreation",
DROP COLUMN "montantCotisation",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateDebut" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dateFin" TIMESTAMP(3),
ADD COLUMN     "montantCycle" BIGINT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "Member";

-- DropEnum
DROP TYPE "ModePaiement";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "passwordHash" TEXT NOT NULL,
    "etat" "MemberStatus" NOT NULL DEFAULT 'ACTIF',
    "dateAdhesion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAlimentaire" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "plafond" DECIMAL(65,30) NOT NULL,
    "montantUtilise" BIGINT NOT NULL DEFAULT 0,
    "montantRestant" BIGINT NOT NULL,
    "dateAttribution" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateExpiration" TIMESTAMP(3),
    "statut" "StatutCreditAlim" NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAlimentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAlimentaireTransaction" (
    "id" SERIAL NOT NULL,
    "creditId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "type" "TypeCreditAlim" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAlimentaireTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gestionnaire" ADD CONSTRAINT "Gestionnaire_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TontineMembre" ADD CONSTRAINT "TontineMembre_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAlimentaire" ADD CONSTRAINT "CreditAlimentaire_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAlimentaireTransaction" ADD CONSTRAINT "CreditAlimentaireTransaction_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CreditAlimentaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
