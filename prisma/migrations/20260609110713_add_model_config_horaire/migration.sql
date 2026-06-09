-- AlterTable
ALTER TABLE "Pointage" ADD COLUMN     "heuresSup" INTEGER,
ADD COLUMN     "justificatif" TEXT,
ADD COLUMN     "retardMinutes" INTEGER,
ADD COLUMN     "tempsTotal" INTEGER,
ADD COLUMN     "valideA" TIMESTAMP(3),
ADD COLUMN     "valideParId" INTEGER;

-- AlterTable
ALTER TABLE "ProfilRH" ADD COLUMN     "configHoraireId" INTEGER;

-- CreateTable
CREATE TABLE "ConfigHoraire" (
    "id" SERIAL NOT NULL,
    "nom" TEXT,
    "heureArrivee" TEXT,
    "heureDepart" TEXT,
    "pauseDejeunnerMinutes" INTEGER,
    "dureeJourneeMinutes" INTEGER,
    "joursOuvres" JSONB,
    "toleranceRetardMin" INTEGER,
    "estDefaut" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigHoraire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfigHoraire_estDefaut_idx" ON "ConfigHoraire"("estDefaut");

-- AddForeignKey
ALTER TABLE "ProfilRH" ADD CONSTRAINT "ProfilRH_configHoraireId_fkey" FOREIGN KEY ("configHoraireId") REFERENCES "ConfigHoraire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
