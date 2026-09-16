-- CreateEnum
CREATE TYPE "StatutBonPreparation" AS ENUM ('EN_COURS', 'PRETE');

-- CreateTable
CREATE TABLE "BonPreparation" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" "StatutBonPreparation" NOT NULL DEFAULT 'EN_COURS',
    "bonSortieId" INTEGER NOT NULL,
    "commandeClientId" INTEGER NOT NULL,
    "preparateurId" INTEGER,
    "datePreparation" TIMESTAMP(3),
    "commentaireEcart" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonPreparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonPreparation" (
    "id" SERIAL NOT NULL,
    "bonPreparationId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantiteDemandee" INTEGER NOT NULL,
    "quantitePreparee" INTEGER NOT NULL,

    CONSTRAINT "LigneBonPreparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonLivraison" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "bonSortieId" INTEGER NOT NULL,
    "commandeClientId" INTEGER NOT NULL,
    "clientNom" TEXT NOT NULL,
    "clientTelephone" TEXT NOT NULL,
    "adresseLivraison" TEXT,
    "livreurId" INTEGER NOT NULL,
    "moyenTransport" TEXT,
    "dateDepart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonLivraison" (
    "id" SERIAL NOT NULL,
    "bonLivraisonId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,

    CONSTRAINT "LigneBonLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonPreparation_reference_key" ON "BonPreparation"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "BonPreparation_bonSortieId_key" ON "BonPreparation"("bonSortieId");

-- CreateIndex
CREATE UNIQUE INDEX "BonPreparation_commandeClientId_key" ON "BonPreparation"("commandeClientId");

-- CreateIndex
CREATE INDEX "BonPreparation_statut_idx" ON "BonPreparation"("statut");

-- CreateIndex
CREATE INDEX "LigneBonPreparation_bonPreparationId_idx" ON "LigneBonPreparation"("bonPreparationId");

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_reference_key" ON "BonLivraison"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_bonSortieId_key" ON "BonLivraison"("bonSortieId");

-- CreateIndex
CREATE UNIQUE INDEX "BonLivraison_commandeClientId_key" ON "BonLivraison"("commandeClientId");

-- CreateIndex
CREATE INDEX "LigneBonLivraison_bonLivraisonId_idx" ON "LigneBonLivraison"("bonLivraisonId");

-- AddForeignKey
ALTER TABLE "BonPreparation" ADD CONSTRAINT "BonPreparation_bonSortieId_fkey" FOREIGN KEY ("bonSortieId") REFERENCES "BonSortie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonPreparation" ADD CONSTRAINT "BonPreparation_commandeClientId_fkey" FOREIGN KEY ("commandeClientId") REFERENCES "CommandeClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonPreparation" ADD CONSTRAINT "BonPreparation_preparateurId_fkey" FOREIGN KEY ("preparateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonPreparation" ADD CONSTRAINT "LigneBonPreparation_bonPreparationId_fkey" FOREIGN KEY ("bonPreparationId") REFERENCES "BonPreparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonPreparation" ADD CONSTRAINT "LigneBonPreparation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_bonSortieId_fkey" FOREIGN KEY ("bonSortieId") REFERENCES "BonSortie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_commandeClientId_fkey" FOREIGN KEY ("commandeClientId") REFERENCES "CommandeClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonLivraison" ADD CONSTRAINT "BonLivraison_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraison" ADD CONSTRAINT "LigneBonLivraison_bonLivraisonId_fkey" FOREIGN KEY ("bonLivraisonId") REFERENCES "BonLivraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonLivraison" ADD CONSTRAINT "LigneBonLivraison_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
