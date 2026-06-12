-- CreateTable
CREATE TABLE "ConfigAlerteRIA" (
    "id" SERIAL NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigAlerteRIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigAlerteRIA_cle_key" ON "ConfigAlerteRIA"("cle");
