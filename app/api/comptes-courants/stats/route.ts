import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";

/**
 * GET /api/comptes-courants/stats
 * États & tableau de bord du module Compte Courant (CDC §14) — capacité READ.
 * Agrège : nombre de comptes par statut, encours global, flux (dépôts/retraits/
 * utilisations), mouvements du mois, retraits en attente, top comptes.
 */
export async function GET() {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const debutMois = new Date();
  debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);

  const [agg, parStatut, retraitsEnAttente, mvtParNature, mvtDuMois, topComptes] = await Promise.all([
    prisma.compteCourant.aggregate({
      _count: true,
      _sum: { solde: true, totalDepose: true, totalRetire: true, totalUtilise: true, nbMouvements: true },
    }),
    prisma.compteCourant.groupBy({
      by: ["statut"], _count: true, _sum: { solde: true },
    }),
    prisma.mouvementCompteCourant.count({ where: { nature: "RETRAIT", statut: "EN_ATTENTE" } }),
    prisma.mouvementCompteCourant.groupBy({
      by: ["nature"], where: { statut: "VALIDE" }, _count: true, _sum: { montant: true },
    }),
    prisma.mouvementCompteCourant.groupBy({
      by: ["nature"], where: { statut: "VALIDE", createdAt: { gte: debutMois } },
      _count: true, _sum: { montant: true },
    }),
    prisma.compteCourant.findMany({
      where: { statut: "ACTIF" },
      orderBy: { solde: "desc" }, take: 5,
      select: {
        id: true, numeroCompte: true, solde: true, nbMouvements: true,
        client: { select: { nom: true, prenom: true } },
      },
    }),
  ]);

  const num = (v: unknown) => Number(v ?? 0);

  return NextResponse.json({
    data: {
      totaux: {
        nbComptes: agg._count,
        encoursGlobal: num(agg._sum.solde),
        totalDepose: num(agg._sum.totalDepose),
        totalRetire: num(agg._sum.totalRetire),
        totalUtilise: num(agg._sum.totalUtilise),
        nbMouvements: num(agg._sum.nbMouvements),
        retraitsEnAttente,
      },
      parStatut: parStatut.map((s) => ({ statut: s.statut, nb: s._count, solde: num(s._sum.solde) })),
      mvtParNature: mvtParNature.map((m) => ({ nature: m.nature, nb: m._count, montant: num(m._sum.montant) })),
      mvtDuMois: mvtDuMois.map((m) => ({ nature: m.nature, nb: m._count, montant: num(m._sum.montant) })),
      topComptes: topComptes.map((c) => ({
        id: c.id, numeroCompte: c.numeroCompte, solde: num(c.solde), nbMouvements: c.nbMouvements,
        client: `${c.client.prenom} ${c.client.nom}`,
      })),
    },
  });
}
