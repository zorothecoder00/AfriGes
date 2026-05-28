import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * POST /api/admin/maintenance/rattrappage-affectations
 *
 * Script de rattrapage one-shot :
 * Pour chaque client sans agentTerrainId qui apparaît dans au moins une
 * CollecteJournaliere VALIDEE, on l'affecte à l'agent de la collecte la plus récente.
 *
 * Règle multi-agents : si un client a été collecté par plusieurs agents,
 * c'est le dernier agent à avoir eu une collecte validée qui hérite du client.
 *
 * Ce endpoint est idempotent : on peut l'appeler plusieurs fois sans danger.
 */
export async function POST(_req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    // 1. Tous les clients sans agent terrain
    const clientsSansAgent = await prisma.client.findMany({
      where: { agentTerrainId: null },
      select: { id: true },
    });

    if (clientsSansAgent.length === 0) {
      return NextResponse.json({ message: "Aucun client sans agent à traiter.", traites: 0 });
    }

    const clientIds = clientsSansAgent.map((c) => c.id);

    // 2. Pour chaque client sans agent, trouver la collecte VALIDEE la plus récente
    //    et l'agent associé
    const lignes = await prisma.ligneCollecte.findMany({
      where: {
        clientId: { in: clientIds },
        collecte: { statut: "VALIDEE" },
      },
      select: {
        clientId: true,
        collecte: {
          select: {
            agentId:      true,
            dateCollecte: true,
          },
        },
      },
      orderBy: { collecte: { dateCollecte: "desc" } },
    });

    // 3. Pour chaque client, garder uniquement l'agent de la collecte la plus récente
    //    (le orderBy desc + Map garantit que la première entrée rencontrée est la plus récente)
    const affectationMap = new Map<number, number>(); // clientId → agentId
    for (const l of lignes) {
      if (!affectationMap.has(l.clientId)) {
        affectationMap.set(l.clientId, l.collecte.agentId);
      }
    }

    if (affectationMap.size === 0) {
      return NextResponse.json({
        message: "Aucun client sans agent n'a de collecte validée associée.",
        traites: 0,
      });
    }

    // 4. Appliquer les affectations dans une transaction
    let traites = 0;
    await prisma.$transaction(async (tx) => {
      for (const [clientId, agentId] of affectationMap.entries()) {
        // Mettre à jour le champ direct
        await tx.client.update({
          where: { id: clientId },
          data:  { agentTerrainId: agentId },
        });

        // Créer l'entrée d'historique si elle n'existe pas déjà
        const existante = await tx.clientAgentAffectation.findFirst({
          where: { clientId, agentId, actif: true },
        });
        if (!existante) {
          await tx.clientAgentAffectation.create({
            data: { clientId, agentId, actif: true },
          });
        }

        traites++;
      }
    });

    return NextResponse.json({
      message: `Rattrapage terminé. ${traites} client(s) affecté(s).`,
      traites,
      detail: [...affectationMap.entries()].map(([clientId, agentId]) => ({ clientId, agentId })),
    });
  } catch (error) {
    console.error("POST /api/admin/maintenance/rattrappage-affectations", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
