-- CreateTable
CREATE TABLE "Conversation" (
    "id" SERIAL NOT NULL,
    "utilisateurAId" INTEGER NOT NULL,
    "utilisateurBId" INTEGER NOT NULL,
    "dernierMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageChat" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "expediteurId" INTEGER NOT NULL,
    "contenu" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "dateLecture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_utilisateurAId_idx" ON "Conversation"("utilisateurAId");

-- CreateIndex
CREATE INDEX "Conversation_utilisateurBId_idx" ON "Conversation"("utilisateurBId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_utilisateurAId_utilisateurBId_key" ON "Conversation"("utilisateurAId", "utilisateurBId");

-- CreateIndex
CREATE INDEX "MessageChat_conversationId_idx" ON "MessageChat"("conversationId");

-- CreateIndex
CREATE INDEX "MessageChat_expediteurId_idx" ON "MessageChat"("expediteurId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_utilisateurAId_fkey" FOREIGN KEY ("utilisateurAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_utilisateurBId_fkey" FOREIGN KEY ("utilisateurBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageChat" ADD CONSTRAINT "MessageChat_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageChat" ADD CONSTRAINT "MessageChat_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
