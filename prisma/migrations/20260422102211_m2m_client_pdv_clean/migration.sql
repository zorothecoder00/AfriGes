-- CreateTable
CREATE TABLE "ClientPointDeVente" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPointDeVente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientPointDeVente_clientId_idx" ON "ClientPointDeVente"("clientId");

-- CreateIndex
CREATE INDEX "ClientPointDeVente_pointDeVenteId_idx" ON "ClientPointDeVente"("pointDeVenteId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPointDeVente_clientId_pointDeVenteId_key" ON "ClientPointDeVente"("clientId", "pointDeVenteId");

-- AddForeignKey
ALTER TABLE "ClientPointDeVente" ADD CONSTRAINT "ClientPointDeVente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPointDeVente" ADD CONSTRAINT "ClientPointDeVente_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
