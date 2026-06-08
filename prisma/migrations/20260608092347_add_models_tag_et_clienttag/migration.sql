-- CreateEnum
CREATE TYPE "SegmentClient" AS ENUM ('ORDINAIRE', 'RIA');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "segment" "SegmentClient" NOT NULL DEFAULT 'ORDINAIRE';

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "segment" "SegmentClient",
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTag" (
    "clientId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientTag_pkey" PRIMARY KEY ("clientId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_nom_key" ON "Tag"("nom");

-- CreateIndex
CREATE INDEX "Tag_segment_idx" ON "Tag"("segment");

-- CreateIndex
CREATE INDEX "Tag_actif_idx" ON "Tag"("actif");

-- CreateIndex
CREATE INDEX "ClientTag_clientId_idx" ON "ClientTag"("clientId");

-- CreateIndex
CREATE INDEX "ClientTag_tagId_idx" ON "ClientTag"("tagId");

-- CreateIndex
CREATE INDEX "Client_segment_idx" ON "Client"("segment");

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
