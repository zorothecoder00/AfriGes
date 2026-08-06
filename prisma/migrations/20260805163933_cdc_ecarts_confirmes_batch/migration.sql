-- AlterTable
ALTER TABLE "CompteComptable" ADD COLUMN     "societeId" INTEGER;

-- AlterTable
ALTER TABLE "LigneBudget" ADD COLUMN     "observation" TEXT,
ADD COLUMN     "produitId" INTEGER;

-- AlterTable
ALTER TABLE "LigneEcriture" ADD COLUMN     "montantLettre" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TaxeConfig" ADD COLUMN     "societeId" INTEGER;

-- AlterTable
ALTER TABLE "TransfertCaisse" ADD COLUMN     "destinationSessionId" INTEGER;

-- CreateTable
CREATE TABLE "RoleJournalAutorise" (
    "id" SERIAL NOT NULL,
    "role" "RoleGestionnaire" NOT NULL,
    "journalCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleJournalAutorise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserJournalAutorise" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "journalCode" TEXT NOT NULL,
    "autorise" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserJournalAutorise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleJournalAutorise_role_idx" ON "RoleJournalAutorise"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleJournalAutorise_role_journalCode_key" ON "RoleJournalAutorise"("role", "journalCode");

-- CreateIndex
CREATE INDEX "UserJournalAutorise_userId_idx" ON "UserJournalAutorise"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserJournalAutorise_userId_journalCode_key" ON "UserJournalAutorise"("userId", "journalCode");

-- CreateIndex
CREATE INDEX "CompteComptable_societeId_idx" ON "CompteComptable"("societeId");

-- CreateIndex
CREATE INDEX "LigneBudget_produitId_idx" ON "LigneBudget"("produitId");

-- CreateIndex
CREATE INDEX "TaxeConfig_societeId_idx" ON "TaxeConfig"("societeId");

-- AddForeignKey
ALTER TABLE "TransfertCaisse" ADD CONSTRAINT "TransfertCaisse_destinationSessionId_fkey" FOREIGN KEY ("destinationSessionId") REFERENCES "SessionCaisse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteComptable" ADD CONSTRAINT "CompteComptable_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBudget" ADD CONSTRAINT "LigneBudget_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxeConfig" ADD CONSTRAINT "TaxeConfig_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJournalAutorise" ADD CONSTRAINT "UserJournalAutorise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
