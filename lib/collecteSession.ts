// lib/collecteSession.ts
// Session de collecte journalière (CollecteJournaliere) d'un agent terrain :
// trouve celle du jour ou la crée. Partagé entre la route authentifiée par
// session (POST /api/agentTerrain/collecteJour) et les routes authentifiées
// par jeton de scan (POST /api/agent-scan/[token]/...), pour que les actions
// faites via le QR public rejoignent le même journal de session que celles
// faites depuis le dashboard.

import { prisma } from "@/lib/prisma";
import type { CollecteJournaliere } from "@prisma/client";

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function tomorrow(): Date {
  const d = today();
  d.setDate(d.getDate() + 1);
  return d;
}

/** Retourne la session EN_COURS du jour de l'agent, ou la crée si absente. */
export async function trouverOuCreerSessionDuJour(agentId: number): Promise<CollecteJournaliere> {
  const debut = today();
  const fin = tomorrow();

  const existing = await prisma.collecteJournaliere.findFirst({
    where: { agentId, dateCollecte: { gte: debut, lt: fin }, statut: { not: "ANNULEE" } },
  });
  if (existing) return existing;

  const gestionnaire = await prisma.gestionnaire.findFirst({
    where: { memberId: agentId, role: "AGENT_TERRAIN" },
    include: {
      member: {
        include: {
          affectationsPDV: { where: { actif: true }, select: { pointDeVenteId: true }, take: 1 },
        },
      },
    },
  });
  const pdvId = gestionnaire?.member?.affectationsPDV[0]?.pointDeVenteId ?? null;

  const echeancesJour = await prisma.echeancePack.findMany({
    where: {
      datePrevue: { gte: debut, lt: fin },
      statut: { in: ["EN_ATTENTE", "EN_RETARD"] },
      souscription: { client: { agentTerrainId: agentId } },
    },
    select: { montant: true },
  });
  const montantPrevu = echeancesJour.reduce((s, e) => s + Number(e.montant), 0);

  const dateStr = debut.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.collecteJournaliere.count();
  const reference = `COL-${dateStr}-${String(count + 1).padStart(3, "0")}`;

  return prisma.collecteJournaliere.create({
    data: { reference, agentId, pointDeVenteId: pdvId, dateCollecte: debut, montantPrevu, statut: "EN_COURS" },
  });
}

/** Résout l'agent propriétaire d'un jeton de scan public (ou null si invalide). */
export async function agentDepuisJetonScan(token: string): Promise<{ id: number; nom: string; prenom: string } | null> {
  if (!token) return null;
  return prisma.user.findUnique({
    where: { scanTokenTournee: token },
    select: { id: true, nom: true, prenom: true },
  });
}
