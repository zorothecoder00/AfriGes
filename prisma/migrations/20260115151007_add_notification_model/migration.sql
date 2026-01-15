-- CreateEnum
CREATE TYPE "PrioriteNotification" AS ENUM ('URGENT', 'HAUTE', 'NORMAL', 'BASSE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priorite" "PrioriteNotification" NOT NULL DEFAULT 'NORMAL',
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "dateLecture" TIMESTAMP(3),
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_uuid_key" ON "Notification"("uuid");

-- CreateIndex
CREATE INDEX "Notification_userId_lue_idx" ON "Notification"("userId", "lue");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
