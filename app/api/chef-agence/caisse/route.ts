import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/caisse?period=30&pdvId=X
 *
 * Supervision caisses de toute la zone (lecture seule) :
 *   - Clôtures récentes avec écarts
 *   - Dépenses (décaissements) par PDV
 *   - Encaissements par PDV
 *   - Sessions actives
 */
export async function GET(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const { searchParams } = new URL(req.url);
    const periodParam = Number(searchParams.get("period") ?? "30");
    const period = [7, 30, 90, 365].includes(periodParam) ? periodParam : 30;
    const pdvIdParam = searchParams.get("pdvId") ? Number(searchParams.get("pdvId")) : null;

    const effectivePdvIds = pdvIdParam
      ? (pdvIds === null || pdvIds.includes(pdvIdParam) ? [pdvIdParam] : [])
      : pdvIds;

    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const pdvFilter        = effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {};
    const sessionPdvFilter = effectivePdvIds
      ? { session: { pointDeVenteId: { in: effectivePdvIds } } }
      : {};

    const [pdvs, clotures, sessionsActives, encaissAgg, decaissParCat] = await Promise.all([
      prisma.pointDeVente.findMany({
        where: effectivePdvIds ? { id: { in: effectivePdvIds }, actif: true } : { actif: true },
        select: { id: true, nom: true, code: true },
        orderBy: { nom: "asc" },
      }),

      prisma.clotureCaisse.findMany({
        where: {
          date: { gte: since },
          ...pdvFilter,
        },
        select: {
          id: true, date: true, caissierNom: true, pointDeVenteId: true,
          totalVentes: true, montantTotal: true, panierMoyen: true, nbClients: true,
          fondsCaisse: true, totalEncaissementsAutres: true, totalDecaissements: true,
          soldeTheorique: true, soldeReel: true, ecart: true, notes: true,
          pointDeVente: { select: { nom: true } },
        },
        orderBy: { date: "desc" },
        take: 100,
      }),

      prisma.sessionCaisse.findMany({
        where: {
          statut: { in: ["OUVERTE", "SUSPENDUE"] },
          ...pdvFilter,
        },
        select: {
          id: true, caissierNom: true, statut: true, fondsCaisse: true,
          dateOuverture: true,
          pointDeVente: { select: { id: true, nom: true } },
        },
      }),

      prisma.operationCaisse.groupBy({
        by: ["type"],
        _sum:   { montant: true },
        _count: { id: true },
        where: {
          type:      "ENCAISSEMENT",
          createdAt: { gte: since },
          ...sessionPdvFilter,
        },
      }),

      prisma.operationCaisse.groupBy({
        by: ["categorie"],
        _sum:   { montant: true },
        _count: { id: true },
        where: {
          type:      "DECAISSEMENT",
          createdAt: { gte: since },
          ...sessionPdvFilter,
        },
      }),
    ]);

    // ── Agrégats par PDV ──────────────────────────────────────────────────────
    const cloturePdvMap: Record<number, { totalMontant: number; totalEcart: number; count: number; avecEcart: number }> = {};
    for (const p of pdvs) cloturePdvMap[p.id] = { totalMontant: 0, totalEcart: 0, count: 0, avecEcart: 0 };
    for (const c of clotures) {
      if (!c.pointDeVenteId) continue;
      const m = cloturePdvMap[c.pointDeVenteId];
      if (!m) continue;
      m.count++;
      m.totalMontant += Number(c.montantTotal);
      const ecart = c.ecart ? Number(c.ecart) : 0;
      m.totalEcart += ecart;
      if (ecart !== 0) m.avecEcart++;
    }

    const totalClotureMontant = clotures.reduce((s, c) => s + Number(c.montantTotal), 0);
    const totalEcart          = clotures.reduce((s, c) => s + (c.ecart ? Number(c.ecart) : 0), 0);
    const cloturesAvecEcart   = clotures.filter((c) => c.ecart && Number(c.ecart) !== 0).length;

    const totalEncaissements = encaissAgg.reduce((s, r) => s + Number(r._sum.montant ?? 0), 0);
    const decaisMap = Object.fromEntries(
      decaissParCat.map((r) => [r.categorie ?? "AUTRE", Number(r._sum.montant ?? 0)])
    );
    const totalDecaissements = decaissParCat.reduce((s, r) => s + Number(r._sum.montant ?? 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        periode: { jours: period, depuis: since.toISOString() },
        stats: {
          totalClotureMontant,
          totalEcart,
          cloturesAvecEcart,
          totalEncaissements,
          totalDecaissements,
          soldeNet: totalEncaissements - totalDecaissements,
        },
        depensesParCategorie: {
          salaires:    decaisMap["SALAIRE"]     ?? 0,
          avances:     decaisMap["AVANCE"]      ?? 0,
          fournisseurs: decaisMap["FOURNISSEUR"] ?? 0,
          autres:      decaisMap["AUTRE"]       ?? 0,
          total:       totalDecaissements,
        },
        sessionsActives: sessionsActives.map((s) => ({
          id:           s.id,
          caissierNom:  s.caissierNom,
          statut:       s.statut,
          fondsCaisse:  Number(s.fondsCaisse),
          dateOuverture: s.dateOuverture.toISOString(),
          pdvNom:       s.pointDeVente?.nom ?? "—",
          pdvId:        s.pointDeVente?.id ?? null,
        })),
        clotures: clotures.map((c) => ({
          id:          c.id,
          date:        c.date.toISOString(),
          pdvNom:      c.pointDeVente?.nom ?? "—",
          pdvId:       c.pointDeVenteId,
          caissierNom: c.caissierNom,
          totalVentes: c.totalVentes,
          nbClients:   c.nbClients,
          montantTotal: Number(c.montantTotal),
          panierMoyen: Number(c.panierMoyen),
          fondsCaisse: Number(c.fondsCaisse),
          totalDecaissements: Number(c.totalDecaissements),
          soldeTheorique: Number(c.soldeTheorique),
          soldeReel:   c.soldeReel ? Number(c.soldeReel) : null,
          ecart:       c.ecart ? Number(c.ecart) : 0,
          hasEcart:    c.ecart ? Number(c.ecart) !== 0 : false,
          notes:       c.notes,
        })),
        parPdv: Object.entries(cloturePdvMap).map(([id, stats]) => ({
          pdvId:  Number(id),
          pdvNom: pdvs.find((p) => p.id === Number(id))?.nom ?? "—",
          ...stats,
        })).sort((a, b) => b.totalMontant - a.totalMontant),
      },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/caisse error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
