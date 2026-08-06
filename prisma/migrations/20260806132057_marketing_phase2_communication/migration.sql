-- CreateEnum
CREATE TYPE "CategorieModeleMessage" AS ENUM ('BIENVENUE', 'CONFIRMATION', 'PROMOTION', 'RELANCE', 'FIDELISATION', 'ANNIVERSAIRE', 'REACTIVATION', 'NOUVEAU_PRODUIT', 'EVENEMENT', 'REMERCIEMENT', 'ENQUETE_SATISFACTION', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeBlocEmail" AS ENUM ('TEXTE', 'IMAGE', 'BOUTON', 'PRODUIT', 'PROMOTION', 'LIEN');

-- CreateEnum
CREATE TYPE "StatutEnvoiMessage" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHEC', 'LIVRE', 'LU', 'REPONSE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "accepteEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "accepteOffres" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "accepteSms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "accepteWhatsapp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "ModeleMessage" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" "CategorieModeleMessage" NOT NULL,
    "canalId" INTEGER NOT NULL,
    "objet" TEXT,
    "contenuTexte" TEXT,
    "contenuBlocs" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeleMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvoiMessage" (
    "id" SERIAL NOT NULL,
    "campagneId" INTEGER,
    "modeleMessageId" INTEGER,
    "canalId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "destinataire" TEXT NOT NULL,
    "contenuRendu" TEXT NOT NULL,
    "statut" "StatutEnvoiMessage" NOT NULL DEFAULT 'EN_ATTENTE',
    "providerMessageId" TEXT,
    "erreur" TEXT,
    "coutEstime" DECIMAL(65,30),
    "envoyeParId" INTEGER NOT NULL,
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraison" TIMESTAMP(3),
    "dateLecture" TIMESTAMP(3),
    "dateReponse" TIMESTAMP(3),

    CONSTRAINT "EnvoiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametrageMarketing" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "maxCommunicationsParSemaine" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "ParametrageMarketing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModeleMessage_canalId_idx" ON "ModeleMessage"("canalId");

-- CreateIndex
CREATE INDEX "ModeleMessage_categorie_idx" ON "ModeleMessage"("categorie");

-- CreateIndex
CREATE INDEX "EnvoiMessage_campagneId_idx" ON "EnvoiMessage"("campagneId");

-- CreateIndex
CREATE INDEX "EnvoiMessage_clientId_idx" ON "EnvoiMessage"("clientId");

-- CreateIndex
CREATE INDEX "EnvoiMessage_statut_idx" ON "EnvoiMessage"("statut");

-- AddForeignKey
ALTER TABLE "ModeleMessage" ADD CONSTRAINT "ModeleMessage_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "CanalMarketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeleMessage" ADD CONSTRAINT "ModeleMessage_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiMessage" ADD CONSTRAINT "EnvoiMessage_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiMessage" ADD CONSTRAINT "EnvoiMessage_modeleMessageId_fkey" FOREIGN KEY ("modeleMessageId") REFERENCES "ModeleMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiMessage" ADD CONSTRAINT "EnvoiMessage_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "CanalMarketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiMessage" ADD CONSTRAINT "EnvoiMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiMessage" ADD CONSTRAINT "EnvoiMessage_envoyeParId_fkey" FOREIGN KEY ("envoyeParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
