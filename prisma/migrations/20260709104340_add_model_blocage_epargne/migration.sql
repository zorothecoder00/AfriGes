-- CreateEnum
CREATE TYPE "StatutBlocageEpargne" AS ENUM ('ACTIF', 'LIBERE', 'ANNULE');

-- CreateTable
CREATE TABLE "BlocageEpargne" (
    "id" SERIAL NOT NULL,
    "compteId" INTEGER NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "motif" TEXT,
    "dateBlocage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateDeblocage" TIMESTAMP(3) NOT NULL,
    "statut" "StatutBlocageEpargne" NOT NULL DEFAULT 'ACTIF',
    "libereLe" TIMESTAMP(3),
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlocageEpargne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlocageEpargne_compteId_idx" ON "BlocageEpargne"("compteId");

-- CreateIndex
CREATE INDEX "BlocageEpargne_statut_idx" ON "BlocageEpargne"("statut");

-- CreateIndex
CREATE INDEX "BlocageEpargne_dateDeblocage_idx" ON "BlocageEpargne"("dateDeblocage");

-- AddForeignKey
ALTER TABLE "BlocageEpargne" ADD CONSTRAINT "BlocageEpargne_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "CompteCourant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlocageEpargne" ADD CONSTRAINT "BlocageEpargne_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
