import { NextRequest, NextResponse } from "next/server";
import { Prisma, StatutBonSortie } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";
import { resolveViewAs } from "@/lib/viewAs";
import { getSeuilVisaBonSortie } from "@/lib/parametresDocuments";

/**
 * GET /api/chef-agence/bons-sortie
 * Bons de sortie des agences supervisées par le chef d'agence (supervision + visa au-delà
 * du seuil, CDC §3.4). L'exécution reste au magasinier ; le visa passe par
 * PATCH /api/magasinier/bons-sortie/[id].
 * Query: statut, origine=AGENT_TERRAIN, pointDeVenteId
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const viewAs = resolveViewAs(req);
    const pdvIds = await getChefAgencePdvIds(session, viewAs?.userId);

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
    console.error("GET /api/chef-agence/bons-sortie", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
