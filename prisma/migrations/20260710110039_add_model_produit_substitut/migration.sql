-- CreateTable
CREATE TABLE "ProduitSubstitut" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "substitutId" INTEGER NOT NULL,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "bidirectionnel" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduitSubstitut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProduitSubstitut_produitId_idx" ON "ProduitSubstitut"("produitId");

-- CreateIndex
CREATE INDEX "ProduitSubstitut_substitutId_idx" ON "ProduitSubstitut"("substitutId");

-- CreateIndex
CREATE UNIQUE INDEX "ProduitSubstitut_produitId_substitutId_key" ON "ProduitSubstitut"("produitId", "substitutId");

-- AddForeignKey
ALTER TABLE "ProduitSubstitut" ADD CONSTRAINT "ProduitSubstitut_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduitSubstitut" ADD CONSTRAINT "ProduitSubstitut_substitutId_fkey" FOREIGN KEY ("substitutId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProduitSubstitut" ADD CONSTRAINT "ProduitSubstitut_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
