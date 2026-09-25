import { NextRequest, NextResponse } from "next/server";
import { Prisma, StatutBonSortie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getComptableSession, getComptablePdvId } from "@/lib/authComptable";
import { resolveViewAs } from "@/lib/viewAs";
import { getSeuilVisaBonSortie } from "@/lib/parametresDocuments";

/**
 * GET /api/comptable/bons-sortie
 * Bons de sortie en lecture pour le comptable (valorisation + comptabilisation, CDC §56) :
 * son agence s'il est affecté à un PDV, sinon toutes les agences. Aucune action.
 * Query: statut, origine=AGENT_TERRAIN, pointDeVenteId
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs = isAdmin ? resolveViewAs(req) : null;
    const pdvId = await getComptablePdvId(session, viewAs?.userId);
    const pdvIds = pdvId === null ? null : [pdvId];

    const { searchParams } = new URL(req.url);
    const statut  = searchParams.get("statut") ?? "";
    const origine = searchParams.get("origine") ?? "";
    const pdvParam = Number(searchParams.get("pointDeVenteId") || 0);

    const where: Prisma.BonSortieWhereInput = {};
    if (pdvIds !== null) where.pointDeVenteId = { in: pdvIds };
    if (pdvParam && (pdvIds === null || pdvIds.includes(pdvParam))) where.pointDeVenteId = pdvParam;
    if (["BROUILLON", "VALIDE", "ANNULE"].includes(statut)) where.statut = statut as StatutBonSortie;
    if (origine === "AGENT_TERRAIN") where.creePar = { gestionnaire: { role: "AGENT_TERRAIN" } };

    const [bons, pdvs, seuilVisaBonSortie] = await Promise.all([
      prisma.bonSortie.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          creePar:   { select: { id: true, nom: true, prenom: true, gestionnaire: { select: { role: true } } } },
          validePar: { select: { nom: true, prenom: true } },
          visePar:   { select: { nom: true, prenom: true } },
          lignes:    { include: { produit: { select: { id: true, nom: true } } } },
          commandeClient: { select: { reference: true, client: { select: { nom: true, prenom: true } } } },
        },
      }),
      prisma.pointDeVente.findMany({
        where: { actif: true, ...(pdvIds !== null ? { id: { in: pdvIds } } : {}) },
        select: { id: true, nom: true, code: true },
        orderBy: { nom: "asc" },
      }),
      getSeuilVisaBonSortie(),
    ]);

    return NextResponse.json({ data: bons, pdvs, seuilVisaBonSortie });
  } catch (error) {
    console.error("GET /api/comptable/bons-sortie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
