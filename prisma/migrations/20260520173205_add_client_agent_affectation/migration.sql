-- CreateTable
CREATE TABLE "ClientAgentAffectation" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAgentAffectation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientAgentAffectation_clientId_idx" ON "ClientAgentAffectation"("clientId");

-- CreateIndex
CREATE INDEX "ClientAgentAffectation_agentId_idx" ON "ClientAgentAffectation"("agentId");

-- CreateIndex
CREATE INDEX "ClientAgentAffectation_clientId_agentId_actif_idx" ON "ClientAgentAffectation"("clientId", "agentId", "actif");

-- AddForeignKey
ALTER TABLE "ClientAgentAffectation" ADD CONSTRAINT "ClientAgentAffectation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAgentAffectation" ADD CONSTRAINT "ClientAgentAffectation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: créer les affectations initiales pour les clients déjà assignés à un agent
INSERT INTO "ClientAgentAffectation" ("clientId", "agentId", "dateDebut", "actif", "createdAt")
SELECT "id", "agentTerrainId", "createdAt", true, NOW()
FROM "Client"
WHERE "agentTerrainId" IS NOT NULL;
