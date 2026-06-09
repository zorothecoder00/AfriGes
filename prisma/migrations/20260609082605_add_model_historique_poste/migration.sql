-- CreateTable
CREATE TABLE "HistoriquePoste" (
    "id" SERIAL NOT NULL,
    "profilRHId" INTEGER NOT NULL,
    "ancienManagerId" INTEGER,
    "ancienneFonction" TEXT,
    "ancienService" TEXT,
    "ancienDepartement" TEXT,
    "nouveauManagerId" INTEGER,
    "nouvelleFonction" TEXT,
    "nouveauService" TEXT,
    "nouveauDepartement" TEXT,
    "motif" TEXT,
    "modifiePar" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoriquePoste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoriquePoste_profilRHId_idx" ON "HistoriquePoste"("profilRHId");

-- CreateIndex
CREATE INDEX "HistoriquePoste_createdAt_idx" ON "HistoriquePoste"("createdAt");

-- AddForeignKey
ALTER TABLE "HistoriquePoste" ADD CONSTRAINT "HistoriquePoste_profilRHId_fkey" FOREIGN KEY ("profilRHId") REFERENCES "ProfilRH"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
