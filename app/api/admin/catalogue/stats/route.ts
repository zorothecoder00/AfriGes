import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import {
  calculerMetrique, synthese, SORTIES_VENTE, PARAMS_DEFAUT,
  type EntreeMetrique, type ParamsAnalyse, type MetriqueProduit,
} from "@/lib/catalogueStats";

/**
 * Tableau de bord & catalogue intelligent (Catalogue §14/§19, Ent.#3) — admin.
 * Agrège le stock courant et les ventes sur la période, puis calcule pour chaque
 * produit actif : rotation, jours de stock, date probable de rupture et
 * suggestion de réapprovisionnement. Renvoie des KPIs de synthèse + listes.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const params: ParamsAnalyse = {
    periodeJours: clampInt(searchParams.get("periode"), PARAMS_DEFAUT.periodeJours, 1, 365),
    horizonJours: clampInt(searchParams.get("horizon"), PARAMS_DEFAUT.horizonJours, 1, 365),
    seuilRuptureJours: clampInt(searchParams.get("seuil"), PARAMS_DEFAUT.seuilRuptureJours, 1, 90),
  };
  const now = new Date();
  const since = new Date(now.getTime() - params.periodeJours * 86400000);

  const [produits, stockAgg, ventesAgg] = await Promise.all([
    prisma.produit.findMany({
      where: { statut: "ACTIF" },
      select: { id: true, nom: true, codeProduit: true, prixUnitaire: true, prixAchat: true },
    }),
    prisma.stockSite.groupBy({
      by: ["produitId"],
      _sum: { quantite: true },
      _max: { stockMin: true },
    }),
    prisma.mouvementStock.groupBy({
      by: ["produitId"],
      where: { type: "SORTIE", typeSortie: { in: [...SORTIES_VENTE] }, dateMouvement: { gte: since } },
      _sum: { quantite: true },
    }),
  ]);

  const stockByProduit = new Map(stockAgg.map((s) => [s.produitId, { stock: s._sum.quantite ?? 0, stockMin: s._max.stockMin ?? null }]));
  const ventesByProduit = new Map(ventesAgg.map((v) => [v.produitId, v._sum.quantite ?? 0]));

  const metriques: MetriqueProduit[] = produits.map((p) => {
    const st = stockByProduit.get(p.id);
    const entree: EntreeMetrique = {
      produitId: p.id, nom: p.nom, codeProduit: p.codeProduit,
      stockActuel: st?.stock ?? 0,
      prixAchat: p.prixAchat != null ? Number(p.prixAchat) : null,
      prixVente: Number(p.prixUnitaire),
      quantiteVendue: ventesByProduit.get(p.id) ?? 0,
      stockMin: st?.stockMin ?? null,
    };
    return calculerMetrique(entree, params, now);
  });

  const topVentes = [...metriques]
    .filter((m) => m.quantiteVendue > 0)
    .sort((a, b) => b.quantiteVendue - a.quantiteVendue)
    .slice(0, 10);

  const reappro = metriques
    .filter((m) => m.quantiteReappro > 0)
    .sort((a, b) => (a.joursDeStock ?? Infinity) - (b.joursDeStock ?? Infinity))
    .slice(0, 30);

  const alertes = metriques
    .filter((m) => m.statutStock === "RUPTURE" || m.statutStock === "CRITIQUE")
    .sort((a, b) => (a.joursDeStock ?? -1) - (b.joursDeStock ?? -1))
    .slice(0, 30);

  const dormants = metriques
    .filter((m) => m.statutStock === "DORMANT")
    .sort((a, b) => b.valeurStock - a.valeurStock)
    .slice(0, 30);

  return NextResponse.json({
    data: { params, synthese: synthese(metriques), topVentes, reappro, alertes, dormants },
  });
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!raw || isNaN(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}
