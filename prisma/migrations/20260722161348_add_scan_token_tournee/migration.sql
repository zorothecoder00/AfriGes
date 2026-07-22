/*
  Warnings:

  - A unique constraint covering the columns `[scanTokenTournee]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "scanTokenTournee" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_scanTokenTournee_key" ON "User"("scanTokenTournee");
