import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

const JOUR_MS = 24 * 60 * 60 * 1000;
const SEUIL_REACTIVATION_JOURS = 60; // écart d'inactivité minimal pour compter un "client réactivé" (CDC §15)

/**
 * GET /api/admin/marketing/stats
 * KPIs du dashboard Marketing (CDC §3) + comparatif par agence (CDC §4).
 *
 * Simplifications assumées (Phase 1, documentées) :
 * - "Leads générés" et "engagement"/"taux de rétention" sont à 0 : ces données
 *   dépendent des formulaires/landing pages (Phase 6) et du moteur de
 *   communication (Phase 2), pas encore construits.
 * - "Marge attribuée" est estimée à partir de Produit.prixAchat (pas d'un coût
 *   réel figé à la vente) — approximation raisonnable en l'absence de CMUP.
 * - Le budget d'une campagne multi-agences est réparti à parts égales entre
 *   ses agences ciblées pour le tableau `parAgence`.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const sp = req.nextUrl.searchParams;
    const debut = sp.get("debut") ? new Date(sp.get("debut")!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fin = sp.get("fin") ? new Date(sp.get("fin")!) : new Date();

    const [campagnes, budgets, depenses, ventesAttribuees, creditsAttribues] = await Promise.all([
      prisma.campagne.findMany({
        select: { id: true, code: true, nom: true, statut: true, agences: { select: { pointDeVenteId: true } } },
      }),
      prisma.budgetMarketing.aggregate({ _sum: { montantPrevu: true, montantApprouve: true } }),
      prisma.depenseMarketing.aggregate({
        where: { date: { gte: debut, lte: fin } },
        _sum: { montant: true },
      }),
      prisma.venteDirecte.findMany({
        where: { campagneId: { not: null }, createdAt: { gte: debut, lte: fin } },
        select: {
          id: true, campagneId: true, clientId: true, pointDeVenteId: true, montantTotal: true, createdAt: true,
          lignes: { select: { quantite: true, montant: true, produit: { select: { prixAchat: true } } } },
        },
      }),
      prisma.creditClient.findMany({
        where: { campagneId: { not: null }, createdAt: { gte: debut, lte: fin } },
        select: { id: true, campagneId: true, clientId: true, montantTotal: true },
      }),
    ]);

    const budgetPrevu = Number(budgets._sum.montantPrevu ?? 0);
    const budgetApprouve = Number(budgets._sum.montantApprouve ?? 0);
    const depensesTotal = Number(depenses._sum.montant ?? 0);

    const caAttribueVentes = ventesAttribuees.reduce((s, v) => s + Number(v.montantTotal), 0);
    const caAttribueCredits = creditsAttribues.reduce((s, c) => s + Number(c.montantTotal), 0);
    const caAttribue = caAttribueVentes + caAttribueCredits;

    const margeAttribuee = ventesAttribuees.reduce((s, v) => {
      const margeVente = v.lignes.reduce((sl, l) => sl + (Number(l.montant) - l.quantite * Number(l.produit?.prixAchat ?? 0)), 0);
      return s + margeVente;
    }, 0);

    // ── Nouveaux clients / clients réactivés attribués (CDC §3, §15) ─────────
    const clientIdsAttribues = [...new Set(ventesAttribuees.map((v) => v.clientId).filter((id): id is number => id != null))];
    let nouveauxClients = 0;
    let clientsReactives = 0;
    if (clientIdsAttribues.length > 0) {
      const historiques = await prisma.venteDirecte.findMany({
        where: { clientId: { in: clientIdsAttribues } },
        select: { clientId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      const parClient = new Map<number, Date[]>();
      for (const h of historiques) {
        if (h.clientId == null) continue;
        const arr = parClient.get(h.clientId) ?? [];
        arr.push(h.createdAt);
        parClient.set(h.clientId, arr);
      }
      for (const clientId of clientIdsAttribues) {
        const venteAttribuee = ventesAttribuees.find((v) => v.clientId === clientId)!;
        const toutes = parClient.get(clientId) ?? [];
        const anterieures = toutes.filter((d) => d < venteAttribuee.createdAt);
        if (anterieures.length === 0) {
          nouveauxClients += 1;
        } else {
          const derniereAnterieure = anterieures[anterieures.length - 1];
          const ecartJours = (venteAttribuee.createdAt.getTime() - derniereAnterieure.getTime()) / JOUR_MS;
          if (ecartJours >= SEUIL_REACTIVATION_JOURS) clientsReactives += 1;
        }
      }
    }

    const campagnesActives = campagnes.filter((c) => c.statut === "ACTIVE").length;
    const campagnesTerminees = campagnes.filter((c) => c.statut === "TERMINEE").length;
    const nbClientsTouches = nouveauxClients + clientsReactives;

    const cac = nbClientsTouches > 0 ? depensesTotal / nbClientsTouches : null;
    const roi = depensesTotal > 0 ? ((caAttribue - depensesTotal) / depensesTotal) * 100 : null;
    const roas = depensesTotal > 0 ? caAttribue / depensesTotal : null;

    // ── Comparatif par agence (CDC §4) ────────────────────────────────────────
    const budgetsParCampagne = await prisma.budgetMarketing.findMany({ select: { campagneId: true, montantApprouve: true } });
    const budgetParCampagneMap = new Map(budgetsParCampagne.map((b) => [b.campagneId, Number(b.montantApprouve)]));

    const parAgenceMap = new Map<number, { budget: number; caAttribue: number; clientIds: Set<number> }>();
    for (const c of campagnes) {
      const budget = budgetParCampagneMap.get(c.id) ?? 0;
      const nbAgences = c.agences.length || 1;
      for (const a of c.agences) {
        const entry = parAgenceMap.get(a.pointDeVenteId) ?? { budget: 0, caAttribue: 0, clientIds: new Set<number>() };
        entry.budget += budget / nbAgences;
        parAgenceMap.set(a.pointDeVenteId, entry);
      }
    }
    for (const v of ventesAttribuees) {
      if (!v.pointDeVenteId) continue;
      const entry = parAgenceMap.get(v.pointDeVenteId) ?? { budget: 0, caAttribue: 0, clientIds: new Set<number>() };
      entry.caAttribue += Number(v.montantTotal);
      if (v.clientId) entry.clientIds.add(v.clientId);
      parAgenceMap.set(v.pointDeVenteId, entry);
    }
    const pdvInfos = await prisma.pointDeVente.findMany({
      where: { id: { in: [...parAgenceMap.keys()] } },
      select: { id: true, nom: true, code: true },
    });
    const parAgence = pdvInfos.map((pdv) => {
      const e = parAgenceMap.get(pdv.id)!;
      return {
        pointDeVenteId: pdv.id,
        nom: pdv.nom,
        code: pdv.code,
        budget: e.budget,
        leads: 0, // Phase 6 (formulaires/landing pages) non construite
        clients: e.clientIds.size,
        caAttribue: e.caAttribue,
        roi: e.budget > 0 ? ((e.caAttribue - e.budget) / e.budget) * 100 : null,
      };
    }).sort((a, b) => b.caAttribue - a.caAttribue);

    const topCampagnes = campagnes
      .map((c) => ({
        id: c.id, code: c.code, nom: c.nom, statut: c.statut,
        caAttribue: ventesAttribuees.filter((v) => v.campagneId === c.id).reduce((s, v) => s + Number(v.montantTotal), 0)
          + creditsAttribues.filter((cr) => cr.campagneId === c.id).reduce((s, cr) => s + Number(cr.montantTotal), 0),
      }))
      .sort((a, b) => b.caAttribue - a.caAttribue)
      .slice(0, 5);

    return NextResponse.json({
      data: {
        totaux: {
          budgetPrevu, budgetApprouve, depenses: depensesTotal,
          campagnesActives, campagnesTerminees,
          leadsGeneres: 0, // Phase 6
          nouveauxClients, clientsReactives,
          ventesAttribuees: ventesAttribuees.length + creditsAttribues.length,
          caAttribue, margeAttribuee,
          coutParLead: null, // Phase 6
          cac, tauxConversion: null, // Phase 6 (funnel lead→client)
          roi, roas,
          engagement: null, tauxRetention: null, // Phase 2/7
        },
        parAgence,
        topCampagnes,
      },
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/stats", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
