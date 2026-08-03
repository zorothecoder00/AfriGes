-- CreateTable
CREATE TABLE "ConfigurationComptableInitiale" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "pays" TEXT NOT NULL DEFAULT 'Togo',
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "referentiel" TEXT NOT NULL DEFAULT 'SYSCOHADA révisé',
    "typeEntite" TEXT NOT NULL DEFAULT 'Société commerciale',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationComptableInitiale_pkey" PRIMARY KEY ("id")
);
