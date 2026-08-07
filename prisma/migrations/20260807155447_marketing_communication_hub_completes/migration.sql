-- AlterEnum
ALTER TYPE "TypeBlocEmail" ADD VALUE 'COUPON';

-- AlterTable
ALTER TABLE "ParametrageMarketing" ADD COLUMN     "coutParSms" DECIMAL(65,30) NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "MessageInterne" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "auteurId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageInterne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageInterne_createdAt_idx" ON "MessageInterne"("createdAt");

-- AddForeignKey
ALTER TABLE "MessageInterne" ADD CONSTRAINT "MessageInterne_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

