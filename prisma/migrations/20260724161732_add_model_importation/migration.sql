-- CreateTable
CREATE TABLE "Importation" (
    "id" SERIAL NOT NULL,
    "bonCommandeId" INTEGER NOT NULL,
    "paysOrigine" TEXT,
    "portDepart" TEXT,
    "portArrivee" TEXT,
    "numeroConteneur" TEXT,
    "incoterm" TEXT,
    "transitaireId" INTEGER,
    "transitaireNom" TEXT,
    "referenceDouane" TEXT,
    "dateDedouanement" TIMESTAMP(3),
    "assurancePolice" TEXT,
    "assuranceMontant" DECIMAL(65,30),
    "dateETD" TIMESTAMP(3),
    "dateETA" TIMESTAMP(3),
    "dateArriveeReelle" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Importation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvenementImportation" (
    "id" SERIAL NOT NULL,
    "importationId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutLivraisonPO",
    "lieu" TEXT,
    "commentaire" TEXT,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvenementImportation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Importation_bonCommandeId_key" ON "Importation"("bonCommandeId");

-- CreateIndex
CREATE INDEX "EvenementImportation_importationId_idx" ON "EvenementImportation"("importationId");

-- AddForeignKey
ALTER TABLE "Importation" ADD CONSTRAINT "Importation_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Importation" ADD CONSTRAINT "Importation_transitaireId_fkey" FOREIGN KEY ("transitaireId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementImportation" ADD CONSTRAINT "EvenementImportation_importationId_fkey" FOREIGN KEY ("importationId") REFERENCES "Importation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementImportation" ADD CONSTRAINT "EvenementImportation_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
