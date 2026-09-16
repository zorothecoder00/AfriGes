-- CreateEnum
CREATE TYPE "StatutTournee" AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutArretTournee" AS ENUM ('PLANIFIE', 'EFFECTUE', 'NON_EFFECTUE', 'INCIDENT');

-- CreateTable
CREATE TABLE "TourneeLivraison" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutTournee" NOT NULL DEFAULT 'PLANIFIEE',
    "livreurId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "dateTournee" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moyenTransport" TEXT,
    "heureDepart" TIMESTAMP(3),
    "heureRetour" TIMESTAMP(3),
    "notes" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourneeLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourneeArret" (
    "id" SERIAL NOT NULL,
    "tourneeId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "statut" "StatutArretTournee" NOT NULL DEFAULT 'PLANIFIE',
    "bonLivraisonId" INTEGER,
    "clientNom" TEXT NOT NULL,
    "clientTelephone" TEXT,
    "adresseLivraison" TEXT,
    "heureArrivee" TIMESTAMP(3),
    "motifNonEffectue" TEXT,
    "incidentDescription" TEXT,
    "signatureClientNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourneeArret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneRetourTournee" (
    "id" SERIAL NOT NULL,
    "arretId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "motif" TEXT,

    CONSTRAINT "LigneRetourTournee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TourneeLivraison_reference_key" ON "TourneeLivraison"("reference");

-- CreateIndex
CREATE INDEX "TourneeLivraison_livreurId_idx" ON "TourneeLivraison"("livreurId");

-- CreateIndex
CREATE INDEX "TourneeLivraison_pointDeVenteId_idx" ON "TourneeLivraison"("pointDeVenteId");

-- CreateIndex
CREATE INDEX "TourneeLivraison_statut_idx" ON "TourneeLivraison"("statut");

-- CreateIndex
CREATE INDEX "TourneeLivraison_dateTournee_idx" ON "TourneeLivraison"("dateTournee");

-- CreateIndex
CREATE UNIQUE INDEX "TourneeArret_bonLivraisonId_key" ON "TourneeArret"("bonLivraisonId");

-- CreateIndex
CREATE INDEX "TourneeArret_tourneeId_idx" ON "TourneeArret"("tourneeId");

-- CreateIndex
CREATE INDEX "TourneeArret_statut_idx" ON "TourneeArret"("statut");

-- CreateIndex
CREATE INDEX "LigneRetourTournee_arretId_idx" ON "LigneRetourTournee"("arretId");

-- AddForeignKey
ALTER TABLE "TourneeLivraison" ADD CONSTRAINT "TourneeLivraison_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourneeLivraison" ADD CONSTRAINT "TourneeLivraison_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourneeLivraison" ADD CONSTRAINT "TourneeLivraison_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourneeArret" ADD CONSTRAINT "TourneeArret_tourneeId_fkey" FOREIGN KEY ("tourneeId") REFERENCES "TourneeLivraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourneeArret" ADD CONSTRAINT "TourneeArret_bonLivraisonId_fkey" FOREIGN KEY ("bonLivraisonId") REFERENCES "BonLivraison"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRetourTournee" ADD CONSTRAINT "LigneRetourTournee_arretId_fkey" FOREIGN KEY ("arretId") REFERENCES "TourneeArret"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneRetourTournee" ADD CONSTRAINT "LigneRetourTournee_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
