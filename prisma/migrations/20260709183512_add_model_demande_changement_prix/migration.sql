-- CreateEnum
CREATE TYPE "StatutDemandePrix" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');

-- CreateEnum
CREATE TYPE "ChampPrixDemande" AS ENUM ('VENTE', 'ACHAT');

-- AlterTable
ALTER TABLE "HistoriquePrixProduit" ADD COLUMN     "agence" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "valideParId" INTEGER;

-- AlterTable
ALTER TABLE "ParametragePrixAuto" ADD COLUMN     "validationPrixObligatoire" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DemandeChangementPrix" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "champ" "ChampPrixDemande" NOT NULL,
    "ancienPrix" DECIMAL(65,30),
    "nouveauPrix" DECIMAL(65,30) NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" "StatutDemandePrix" NOT NULL DEFAULT 'EN_ATTENTE',
    "demandeParId" INTEGER NOT NULL,
    "ip" TEXT,
    "agence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valideParId" INTEGER,
    "valideAt" TIMESTAMP(3),
    "motifRejet" TEXT,

    CONSTRAINT "DemandeChangementPrix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeChangementPrix_produitId_idx" ON "DemandeChangementPrix"("produitId");

-- CreateIndex
CREATE INDEX "DemandeChangementPrix_statut_idx" ON "DemandeChangementPrix"("statut");

-- AddForeignKey
ALTER TABLE "DemandeChangementPrix" ADD CONSTRAINT "DemandeChangementPrix_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeChangementPrix" ADD CONSTRAINT "DemandeChangementPrix_demandeParId_fkey" FOREIGN KEY ("demandeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeChangementPrix" ADD CONSTRAINT "DemandeChangementPrix_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
