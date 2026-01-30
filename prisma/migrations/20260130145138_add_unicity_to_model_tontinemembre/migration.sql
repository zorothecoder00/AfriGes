/*
  Warnings:

  - A unique constraint covering the columns `[tontineId,memberId]` on the table `TontineMembre` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TontineMembre_tontineId_memberId_key" ON "TontineMembre"("tontineId", "memberId");
