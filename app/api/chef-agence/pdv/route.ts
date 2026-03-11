import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/pdv?period=30
 *
 * Statistiques détaillées de chaque PDV de la zone du chef d'agence :
 *   - CA (VD + VP) sur la période
 *   - Stock : valeur, ruptures, alertes
 *   - Équipe affectée (count par rôle)
 *   - Dernière clôture caisse
 *   - Anomalies en cours
 */
export async function GET(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const { searchParams } = new URL(req.url);
    const periodParam = Number(searchParams.get("period") ?? "30");
    const period = [7, 30, 90, 365].includes(periodParam) ? periodParam : 30;

    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    const pdvFilter      = pdvIds ? { id: { in: pdvIds } } : {};
    const ventePdvFilter = pdvIds ? { pointDeVenteId: { in: pdvIds } } : {};
    const versFilter     = pdvIds
      ? { souscription: { client: { pointDeVenteId: { in: pdvIds } } } }
      : {};

    const [pdvs, ventesDir, versements, stocks, affectations, clotures, anomalies] = await Promise.all([
      prisma.pointDeVente.findMany({
        where: { ...pdvFilter, actif: true },
        select: {
          id: true, nom: true, code: true, type: true, adresse: true, telephone: true,
          rpv: { select: { id: true, nom: true, prenom: true, telephone: true } },
          sessionsCaisse: {
            where: { statut: "OUVERTE" },
            select: { id: true, caissierNom: true },
          },
        },
        orderBy: { nom: "asc" },
      }),

      prisma.venteDirecte.findMany({
        where: {
          statut: { notIn: ["BROUILLON", "ANNULEE"] },
          createdAt: { gte: since },
          ...ventePdvFilter,
        },
        select: { pointDeVenteId: true, montantPaye: true, vendeurId: true },
      }),

      prisma.versementPack.findMany({
        where: { datePaiement: { gte: since }, ...versFilter },
        select: {
          montant: true,
          souscription: { select: { client: { select: { pointDeVenteId: true } } } },
        },
      }),

      prisma.stockSite.findMany({
        where: pdvIds ? { pointDeVenteId: { in: pdvIds } } : {},
        select: {
          pointDeVenteId: true, quantite: true, alerteStock: true,
          produit: { select: { prixUnitaire: true, alerteStock: true } },
        },
      }),

      prisma.gestionnaireAffectation.findMany({
        where: {
          actif: true,
          ...(pdvIds ? { pointDeVenteId: { in: pdvIds } } : {}),
        },
        select: {
          pointDeVenteId: true,
          user: { select: { gestionnaire: { select: { role: true } } } },
        },
      }),

      prisma.clotureCaisse.findMany({
        where: {
          ...(pdvIds ? { pointDeVenteId: { in: pdvIds } } : {}),
        },
        orderBy: { date: "desc" },
        select: { pointDeVenteId: true, date: true, montantTotal: true, ecart: true, caissierNom: true },
        take: pdvIds ? pdvIds.length * 3 : 50,
      }),

      prisma.anomalieStock.groupBy({
        by: ["pointDeVenteId"],
        where: {
          statut: { in: ["EN_ATTENTE", "EN_COURS"] },
          ...(pdvIds ? { pointDeVenteId: { in: pdvIds } } : {}),
        },
        _count: { id: true },
      }),
    ]);

    // ── Agrégats par PDV ──────────────────────────────────────────────────────
    const caMap: Record<number, { vd: number; vp: number }> = {};
    for (const v of ventesDir) {
      if (!caMap[v.pointDeVenteId]) caMap[v.pointDeVenteId] = { vd: 0, vp: 0 };
      caMap[v.pointDeVenteId].vd += Number(v.montantPaye);
    }
    for (const v of versements) {
      const pdvId = v.souscription.client?.pointDeVenteId;
      if (!pdvId) continue;
      if (!caMap[pdvId]) caMap[pdvId] = { vd: 0, vp: 0 };
      caMap[pdvId].vp += Number(v.montant);
    }

    const stockMap: Record<number, { valeur: number; ruptures: number; faibles: number; total: number }> = {};
    for (const s of stocks) {
      if (!stockMap[s.pointDeVenteId]) stockMap[s.pointDeVenteId] = { valeur: 0, ruptures: 0, faibles: 0, total: 0 };
      stockMap[s.pointDeVenteId].total++;
      stockMap[s.pointDeVenteId].valeur += s.quantite * Number(s.produit.prixUnitaire);
      const seuil = s.alerteStock ?? s.produit.alerteStock;
      if (s.quantite === 0) stockMap[s.pointDeVenteId].ruptures++;
      else if (seuil > 0 && s.quantite <= seuil) stockMap[s.pointDeVenteId].faibles++;
    }

    const equipeMap: Record<number, Record<string, number>> = {};
    for (const a of affectations) {
      if (!equipeMap[a.pointDeVenteId]) equipeMap[a.pointDeVenteId] = {};
      const role = a.user.gestionnaire?.role ?? "AUTRE";
      equipeMap[a.pointDeVenteId][role] = (equipeMap[a.pointDeVenteId][role] ?? 0) + 1;
    }

    const clotureMap: Record<number, typeof clotures[0]> = {};
    for (const c of clotures) {
      if (c.pointDeVenteId && !clotureMap[c.pointDeVenteId]) clotureMap[c.pointDeVenteId] = c;
    }

    const anomalieMap: Record<number, number> = {};
    for (const a of anomalies) {
      if (a.pointDeVenteId) anomalieMap[a.pointDeVenteId] = a._count.id;
    }

    const data = pdvs.map((p) => {
      const ca      = caMap[p.id] ?? { vd: 0, vp: 0 };
      const stock   = stockMap[p.id] ?? { valeur: 0, ruptures: 0, faibles: 0, total: 0 };
      const equipe  = equipeMap[p.id] ?? {};
      const dernClt = clotureMap[p.id];
      return {
        id:          p.id,
        nom:         p.nom,
        code:        p.code,
        type:        p.type,
        adresse:     p.adresse,
        telephone:   p.telephone,
        rpv:         p.rpv,
        caissOuverte: p.sessionsCaisse.length > 0,
        caissier:    p.sessionsCaisse[0]?.caissierNom ?? null,
        ca: {
          ventesDirectes: ca.vd,
          versementsPacks: ca.vp,
          total: ca.vd + ca.vp,
        },
        stock,
        equipe,
        nbEquipe: Object.values(equipe).reduce((s, v) => s + v, 0),
        derniereCloture: dernClt
          ? {
              date:         dernClt.date.toISOString(),
              montantTotal: Number(dernClt.montantTotal),
              ecart:        dernClt.ecart ? Number(dernClt.ecart) : 0,
              hasEcart:     dernClt.ecart ? Number(dernClt.ecart) !== 0 : false,
              caissierNom:  dernClt.caissierNom,
            }
          : null,
        nbAnomalies: anomalieMap[p.id] ?? 0,
      };
    });

    const totalCa = data.reduce((s, p) => s + p.ca.total, 0);

    return NextResponse.json({
      success: true,
      data,
      stats: {
        nbPdvs: data.length,
        totalCa,
        periode: period,
      },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/pdv error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
