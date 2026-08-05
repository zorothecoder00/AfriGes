-- CreateTable
CREATE TABLE "BackupLog" (
    "id" SERIAL NOT NULL,
    "dateExecution" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL,
    "tailleOctets" INTEGER,
    "url" TEXT,
    "erreur" TEXT,
    "dureeMs" INTEGER,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupLog_dateExecution_idx" ON "BackupLog"("dateExecution");
