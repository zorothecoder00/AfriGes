-- CreateEnum
CREATE TYPE "StatutLigneSouscription" AS ENUM ('EN_ATTENTE', 'CONFIRME', 'INDISPONIBLE', 'SUBSTITUE', 'ANNULE');

-- CreateTable
CREATE TABLE "LigneSouscriptionProduit" (
    "id" SERIAL NOT NULL,
    "souscriptionId" INTEGER NOT NULL,
    "produitId" INTEGER,
    "produitNomSaisi" TEXT NOT NULL,
    "categorieSaisie" TEXT,
    "uniteSaisie" TEXT,
    "quantite" INTEGER NOT NULL,
    "quantiteParCycle" INTEGER,
    "prixEstime" DECIMAL(65,30),
    "statut" "StatutLigneSouscription" NOT NULL DEFAULT 'EN_ATTENTE',
    "estNouveauProduit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "produitSubstitutId" INTEGER,
    "traiteParId" INTEGER,
    "dateTraitement" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LigneSouscriptionProduit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LigneSouscriptionProduit_souscriptionId_idx" ON "LigneSouscriptionProduit"("souscriptionId");

-- CreateIndex
CREATE INDEX "LigneSouscriptionProduit_statut_idx" ON "LigneSouscriptionProduit"("statut");

-- AddForeignKey
ALTER TABLE "LigneSouscriptionProduit" ADD CONSTRAINT "LigneSouscriptionProduit_souscriptionId_fkey" FOREIGN KEY ("souscriptionId") REFERENCES "SouscriptionPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneSouscriptionProduit" ADD CONSTRAINT "LigneSouscriptionProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneSouscriptionProduit" ADD CONSTRAINT "LigneSouscriptionProduit_produitSubstitutId_fkey" FOREIGN KEY ("produitSubstitutId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneSouscriptionProduit" ADD CONSTRAINT "LigneSouscriptionProduit_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
