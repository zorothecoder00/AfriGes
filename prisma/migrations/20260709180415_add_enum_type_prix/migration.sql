-- CreateEnum
CREATE TYPE "TypePrix" AS ENUM ('ACHAT', 'FOURNISSEUR', 'REVIENT', 'GROS', 'DETAIL', 'COMMUNAUTE', 'VIP', 'PROMOTION', 'PERSONNEL', 'PARTENAIRE', 'REVENDEUR', 'CREDIT', 'NOUVEAU_CLIENT', 'FIDELE');

-- CreateEnum
CREATE TYPE "PorteePrix" AS ENUM ('GLOBAL', 'AGENCE', 'VILLE', 'REGION');

-- CreateTable
CREATE TABLE "PrixProduit" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "type" "TypePrix" NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "portee" "PorteePrix" NOT NULL DEFAULT 'GLOBAL',
    "pointDeVenteId" INTEGER,
    "ville" TEXT,
    "region" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrixProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametragePrixAuto" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "margeCiblePct" DECIMAL(65,30) NOT NULL DEFAULT 20,
    "fraisLogistiquePct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "arrondi" INTEGER NOT NULL DEFAULT 0,
    "appliquerSurCredit" BOOLEAN NOT NULL DEFAULT false,
    "margeCreditPct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametragePrixAuto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrixProduit_produitId_idx" ON "PrixProduit"("produitId");

-- CreateIndex
CREATE INDEX "PrixProduit_type_idx" ON "PrixProduit"("type");

-- CreateIndex
CREATE INDEX "PrixProduit_produitId_type_portee_idx" ON "PrixProduit"("produitId", "type", "portee");

-- CreateIndex
CREATE INDEX "PrixProduit_pointDeVenteId_idx" ON "PrixProduit"("pointDeVenteId");

-- AddForeignKey
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrixProduit" ADD CONSTRAINT "PrixProduit_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
