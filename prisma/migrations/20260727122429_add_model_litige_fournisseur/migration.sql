-- CreateEnum
CREATE TYPE "StatutLitigeFournisseur" AS ENUM ('OUVERT', 'RESOLU', 'REJETE');

-- CreateTable
CREATE TABLE "LitigeFournisseur" (
    "id" SERIAL NOT NULL,
    "fournisseurId" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "description" TEXT,
    "statut" "StatutLitigeFournisseur" NOT NULL DEFAULT 'OUVERT',
    "bonCommandeId" INTEGER,
    "creeParId" INTEGER NOT NULL,
    "resoluParId" INTEGER,
    "dateResolution" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LitigeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LitigeFournisseur_fournisseurId_idx" ON "LitigeFournisseur"("fournisseurId");

-- CreateIndex
CREATE INDEX "LitigeFournisseur_statut_idx" ON "LitigeFournisseur"("statut");

-- AddForeignKey
ALTER TABLE "LitigeFournisseur" ADD CONSTRAINT "LitigeFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitigeFournisseur" ADD CONSTRAINT "LitigeFournisseur_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitigeFournisseur" ADD CONSTRAINT "LitigeFournisseur_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitigeFournisseur" ADD CONSTRAINT "LitigeFournisseur_resoluParId_fkey" FOREIGN KEY ("resoluParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
