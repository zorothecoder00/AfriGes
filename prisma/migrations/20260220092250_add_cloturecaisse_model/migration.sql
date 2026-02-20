-- CreateTable
CREATE TABLE "ClotureCaisse" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "caissierNom" TEXT NOT NULL,
    "totalVentes" INTEGER NOT NULL,
    "montantTotal" DECIMAL(65,30) NOT NULL,
    "panierMoyen" DECIMAL(65,30) NOT NULL,
    "nbClients" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClotureCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClotureCaisse_date_key" ON "ClotureCaisse"("date");
