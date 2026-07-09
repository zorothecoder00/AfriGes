-- CreateEnum
CREATE TYPE "TypeCompteCC" AS ENUM ('INDIVIDUEL', 'MENAGE', 'COMMUNAUTE', 'GROUPEMENT');

-- CreateEnum
CREATE TYPE "RoleMembreCC" AS ENUM ('TITULAIRE', 'MANDATAIRE', 'MEMBRE');

-- DropIndex
DROP INDEX "CompteCourant_clientId_key";

-- AlterTable
ALTER TABLE "CompteCourant" ADD COLUMN     "libelle" TEXT,
ADD COLUMN     "typeCompte" "TypeCompteCC" NOT NULL DEFAULT 'INDIVIDUEL';

-- CreateTable
CREATE TABLE "MembreCompteCourant" (
    "id" SERIAL NOT NULL,
    "compteId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "role" "RoleMembreCC" NOT NULL DEFAULT 'MEMBRE',
    "quotePart" DECIMAL(65,30),
    "ajouteParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembreCompteCourant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembreCompteCourant_compteId_idx" ON "MembreCompteCourant"("compteId");

-- CreateIndex
CREATE INDEX "MembreCompteCourant_clientId_idx" ON "MembreCompteCourant"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MembreCompteCourant_compteId_clientId_key" ON "MembreCompteCourant"("compteId", "clientId");

-- CreateIndex
CREATE INDEX "CompteCourant_clientId_idx" ON "CompteCourant"("clientId");

-- CreateIndex
CREATE INDEX "CompteCourant_typeCompte_idx" ON "CompteCourant"("typeCompte");

-- AddForeignKey
ALTER TABLE "MembreCompteCourant" ADD CONSTRAINT "MembreCompteCourant_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteCourant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreCompteCourant" ADD CONSTRAINT "MembreCompteCourant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreCompteCourant" ADD CONSTRAINT "MembreCompteCourant_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
