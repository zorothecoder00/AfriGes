-- CreateTable
CREATE TABLE "ClotureComptable" (
    "id" SERIAL NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "notes" TEXT,
    "cloturePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClotureComptable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClotureComptable_annee_mois_key" ON "ClotureComptable"("annee", "mois");

-- AddForeignKey
ALTER TABLE "ClotureComptable" ADD CONSTRAINT "ClotureComptable_cloturePar_fkey" FOREIGN KEY ("cloturePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
