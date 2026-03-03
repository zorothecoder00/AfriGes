-- CreateTable
CREATE TABLE "JournalValidation" (
    "id" SERIAL NOT NULL,
    "entryId" TEXT NOT NULL,
    "notes" TEXT,
    "valideParId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalValidation_entryId_key" ON "JournalValidation"("entryId");

-- CreateIndex
CREATE INDEX "JournalValidation_entryId_idx" ON "JournalValidation"("entryId");

-- AddForeignKey
ALTER TABLE "JournalValidation" ADD CONSTRAINT "JournalValidation_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
