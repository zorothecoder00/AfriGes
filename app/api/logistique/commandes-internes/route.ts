import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "../fournisseurs/route";

/**
 * GET /api/logistique/commandes-internes
 *
 * File d'attente des demandes d'approvisionnement remontées par les niveaux
 * inférieurs (RPV/magasinier au niveau point de vente, chef d'agence au niveau
 * agence commerciale) — CDC §3/§4 "chaque niveau doit pouvoir générer des
 * demandes d'approvisionnement". Le Responsable Approvisionnement Central les
 * valide/rejette ici, puis peut créer une RFQ à partir des lignes validées.
 *
 * Query: statut?, pointDeVenteId?, page?, limit?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") || 20)));
    const statut = searchParams.get("statut") || "";
    const pointDeVenteId = searchParams.get("pointDeVenteId") ? Number(searchParams.get("pointDeVenteId")) : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (pointDeVenteId) where.pointDeVenteId = pointDeVenteId;

    const [data, total, statsRaw, soumises] = await Promise.all([
      prisma.commandeInterne.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
          demandeur: { select: { id: true, nom: true, prenom: true } },
          lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true, unite: true } } } },
        },
      }),
      prisma.commandeInterne.count({ where }),
      prisma.commandeInterne.groupBy({ by: ["statut"], _count: { _all: true } }),
      // Agrégation multi-agences (CDC §7 étape 3 — "le système fusionne les
      // demandes similaires") : toutes les demandes SOUMISE, indépendamment du
      // filtre de statut de la liste, pour proposer un total prêt pour la RFQ.
      prisma.commandeInterne.findMany({
        where: { statut: "SOUMISE" },
        select: {
          pointDeVente: { select: { nom: true } },
          lignes: {
            select: { produitId: true, quantiteDemandee: true, produit: { select: { nom: true, codeProduit: true, unite: true } } },
          },
        },
      }),
    ]);

    const stats: Record<string, number> = {};
    for (const s of statsRaw) stats[s.statut] = s._count._all;

    const agregatMap = new Map<number, {
      produitId: number; produitNom: string; codeProduit: string | null; unite: string | null;
      quantiteTotale: number; detail: { pdvNom: string; quantite: number }[];
    }>();
    for (const c of soumises) {
      for (const l of c.lignes) {
        const existing = agregatMap.get(l.produitId) ?? {
          produitId: l.produitId, produitNom: l.produit.nom, codeProduit: l.produit.codeProduit, unite: l.produit.unite,
          quantiteTotale: 0, detail: [],
        };
        existing.quantiteTotale += l.quantiteDemandee;
        existing.detail.push({ pdvNom: c.pointDeVente.nom, quantite: l.quantiteDemandee });
        agregatMap.set(l.produitId, existing);
      }
    }
    const agregatParProduit = Array.from(agregatMap.values()).sort((a, b) => b.quantiteTotale - a.quantiteTotale);

    return NextResponse.json({
      data,
      stats,
      agregatParProduit,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/commandes-internes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
