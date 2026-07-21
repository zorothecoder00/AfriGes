/*
  Warnings:

  - Made the column `pointDeVenteId` on table `ParametragePOPC` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ParametragePOPC" ALTER COLUMN "pointDeVenteId" SET NOT NULL,
ALTER COLUMN "pointDeVenteId" SET DEFAULT 0;
