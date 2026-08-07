-- CreateEnum
CREATE TYPE "StatutTestAB" AS ENUM ('BROUILLON', 'EN_COURS', 'TERMINE');

-- CreateEnum
CREATE TYPE "VarianteTestAB" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "TestAB" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "campagneId" INTEGER NOT NULL,
    "canalId" INTEGER NOT NULL,
    "modeleAId" INTEGER NOT NULL,
    "modeleBId" INTEGER NOT NULL,
    "statut" "StatutTestAB" NOT NULL DEFAULT 'BROUILLON',
    "dateLancement" TIMESTAMP(3),
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestAB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestABAssignation" (
    "id" SERIAL NOT NULL,
    "testId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "variante" "VarianteTestAB" NOT NULL,
    "converti" BOOLEAN NOT NULL DEFAULT false,
    "dateConversion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestABAssignation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestAB_campagneId_idx" ON "TestAB"("campagneId");

-- CreateIndex
CREATE INDEX "TestABAssignation_testId_idx" ON "TestABAssignation"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "TestABAssignation_testId_clientId_key" ON "TestABAssignation"("testId", "clientId");

-- AddForeignKey
ALTER TABLE "TestAB" ADD CONSTRAINT "TestAB_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAB" ADD CONSTRAINT "TestAB_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "CanalMarketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAB" ADD CONSTRAINT "TestAB_modeleAId_fkey" FOREIGN KEY ("modeleAId") REFERENCES "ModeleMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAB" ADD CONSTRAINT "TestAB_modeleBId_fkey" FOREIGN KEY ("modeleBId") REFERENCES "ModeleMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAB" ADD CONSTRAINT "TestAB_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestABAssignation" ADD CONSTRAINT "TestABAssignation_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestAB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestABAssignation" ADD CONSTRAINT "TestABAssignation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

