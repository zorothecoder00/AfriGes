-- AlterTable
ALTER TABLE "MessageChat" ADD COLUMN     "modifie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modifieAt" TIMESTAMP(3),
ADD COLUMN     "supprime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supprimeAt" TIMESTAMP(3);
