-- CreateEnum
CREATE TYPE "TypeLivraison" AS ENUM ('RECEPTION', 'EXPEDITION');

-- CreateEnum
CREATE TYPE "StatutLivraison" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'LIVREE', 'ANNULEE');

-- CreateTable
CREATE TABLE "Livraison" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TypeLivraison" NOT NULL,
    "statut" "StatutLivraison" NOT NULL DEFAULT 'EN_ATTENTE',
    "fournisseurNom" TEXT,
    "destinataireNom" TEXT,
    "datePrevisionnelle" TIMESTAMP(3) NOT NULL,
    "dateLivraison" TIMESTAMP(3),
    "notes" TEXT,
    "planifiePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivraisonLigne" (
    "id" SERIAL NOT NULL,
    "livraisonId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantitePrevue" INTEGER NOT NULL,
    "quantiteRecue" INTEGER,

    CONSTRAINT "LivraisonLigne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Livraison_reference_key" ON "Livraison"("reference");

-- AddForeignKey
ALTER TABLE "LivraisonLigne" ADD CONSTRAINT "LivraisonLigne_livraisonId_fkey" FOREIGN KEY ("livraisonId") REFERENCES "Livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivraisonLigne" ADD CONSTRAINT "LivraisonLigne_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
