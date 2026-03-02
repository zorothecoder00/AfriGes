-- CreateTable
CREATE TABLE "PieceJustificative" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadthingKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "description" TEXT,
    "uploadePar" INTEGER NOT NULL,
    "archiverJusquau" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceJustificative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PieceJustificative_sourceType_sourceId_idx" ON "PieceJustificative"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "PieceJustificative" ADD CONSTRAINT "PieceJustificative_uploadePar_fkey" FOREIGN KEY ("uploadePar") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
