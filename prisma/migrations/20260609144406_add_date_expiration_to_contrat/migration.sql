-- AlterTable
ALTER TABLE "DocumentCollaborateur" ADD COLUMN     "dateExpiration" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PreferenceNotificationRH" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "canalApp" BOOLEAN NOT NULL DEFAULT true,
    "canalEmail" BOOLEAN NOT NULL DEFAULT false,
    "finContrat" BOOLEAN NOT NULL DEFAULT true,
    "validationConge" BOOLEAN NOT NULL DEFAULT true,
    "evaluationProg" BOOLEAN NOT NULL DEFAULT true,
    "formationAsuivre" BOOLEAN NOT NULL DEFAULT true,
    "documentExpirant" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceNotificationRH_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceNotificationRH_userId_key" ON "PreferenceNotificationRH"("userId");

-- CreateIndex
CREATE INDEX "PreferenceNotificationRH_userId_idx" ON "PreferenceNotificationRH"("userId");

-- CreateIndex
CREATE INDEX "DocumentCollaborateur_dateExpiration_idx" ON "DocumentCollaborateur"("dateExpiration");

-- AddForeignKey
ALTER TABLE "PreferenceNotificationRH" ADD CONSTRAINT "PreferenceNotificationRH_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
