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

  const [agg, parStatut, retraitsEnAttente, mvtParNature, mvtDuMois, topComptes, depotsMoisRaw] = await Promise.all([
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
    // Top 100 épargnants (par solde)
    prisma.compteCourant.findMany({
      where: { statut: "ACTIF" },
      orderBy: { solde: "desc" }, take: 100,
      select: {
        id: true, numeroCompte: true, solde: true, nbMouvements: true,
        client: { select: { nom: true, prenom: true } },
      },
    }),
    // Top dépôts du mois (somme des dépôts validés par compte, mois en cours)
    prisma.mouvementCompteCourant.groupBy({
      by: ["compteId"],
      where: { nature: "DEPOT", statut: "VALIDE", createdAt: { gte: debutMois } },
      _sum: { montant: true }, _count: true,
      orderBy: { _sum: { montant: "desc" } }, take: 20,
    }),
  ]);

  const num = (v: unknown) => Number(v ?? 0);

  // Résolution des titulaires pour le classement des dépôts du mois.
  const depotComptes = depotsMoisRaw.length
    ? await prisma.compteCourant.findMany({
        where: { id: { in: depotsMoisRaw.map((d) => d.compteId) } },
        select: { id: true, numeroCompte: true, client: { select: { nom: true, prenom: true } } },
      })
    : [];
  const depotComptesMap = new Map(depotComptes.map((c) => [c.id, c]));

  const nbComptes     = agg._count;
  const encoursGlobal = num(agg._sum.solde);
  const comptesActifs = parStatut.find((s) => s.statut === "ACTIF")?._count ?? 0;
  const comptesInactifs = nbComptes - comptesActifs; // statut ≠ ACTIF
  const soldeMoyen    = nbComptes > 0 ? Math.round(encoursGlobal / nbComptes) : 0;

  return NextResponse.json({
    data: {
      totaux: {
        nbComptes,
        comptesActifs,
        comptesInactifs,
        encoursGlobal,          // = total disponible
        totalDepose: num(agg._sum.totalDepose),
        totalRetire: num(agg._sum.totalRetire),
        totalUtilise: num(agg._sum.totalUtilise),
        soldeMoyen,
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
      topDepotsMois: depotsMoisRaw.map((d) => {
        const c = depotComptesMap.get(d.compteId);
        return {
          id: d.compteId,
          numeroCompte: c?.numeroCompte ?? "—",
          client: c ? `${c.client.prenom} ${c.client.nom}` : "—",
          total: num(d._sum.montant),
          nb: d._count,
        };
      }),
    },
  });
}
