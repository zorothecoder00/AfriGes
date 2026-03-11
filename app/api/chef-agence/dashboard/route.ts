import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/dashboard
 *
 * Vue macro du chef d'agence sur sa zone :
 *   - KPIs globaux (CA, agents, clients, stock)
 *   - Top PDVs par CA
 *   - Alertes (stock faible, clôtures manquantes, écarts caisse)
 *   - Anomalies résumé
 *   - Dernières ventes de la zone
 */
export async function GET() {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);
    // pdvIds === null → admin, pas de restriction ; [] → pas de PDV

    const now          = new Date();
    const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay     = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const il30j        = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const il7j         = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

    const pdvFilter        = pdvIds ? { id: { in: pdvIds } } : {};
    const ventePdvFilter   = pdvIds ? { pointDeVenteId: { in: pdvIds } } : {};
    const stockPdvFilter   = pdvIds ? { pointDeVenteId: { in: pdvIds } } : {};
    const cloturePdvFilter = pdvIds ? { pointDeVenteId: { in: pdvIds } } : {};
    const versFilter       = pdvIds ? { souscription: { client: { pointDeVenteId: { in: pdvIds } } } } : {};

    // ── Toutes les données en parallèle ────────────────────────────────────────
    const [
      pdvs,
      agentsCount,
      clientsCount,
      ventesDir30j,
      versements30j,
      stockSites,
      clotures7j,
      anomaliesStock,
      receptions,
      transfertsZone,
      ventesAujourdhui,
      versemsAujourdhui,
    ] = await Promise.all([

      // PDVs de la zone avec leurs stocks et sessions
      prisma.pointDeVente.findMany({
        where: { ...pdvFilter, actif: true },
        select: {
          id: true, nom: true, code: true, type: true,
          rpv: { select: { nom: true, prenom: true } },
          stocks: { select: { quantite: true, alerteStock: true, produitId: true } },
          sessionsCaisse: {
            where: { statut: "OUVERTE" },
            select: { id: true },
          },
        },
      }),

      // Nombre d'agents affectés aux PDVs de la zone
      prisma.gestionnaireAffectation.count({
        where: {
          actif: true,
          ...(pdvIds ? { pointDeVenteId: { in: pdvIds } } : {}),
        },
      }),

      // Clients de la zone
      prisma.client.count({
        where: {
          ...(pdvIds ? { pointDeVenteId: { in: pdvIds } } : {}),
        },
      }),

      // Ventes directes 30j
      prisma.venteDirecte.findMany({
        where: {
          statut: { notIn: ["BROUILLON", "ANNULEE"] },
          createdAt: { gte: il30j },
          ...ventePdvFilter,
        },
        select: { id: true, montantPaye: true, pointDeVenteId: true, createdAt: true },
      }),

      // Versements packs 30j
      prisma.versementPack.findMany({
        where: {
          datePaiement: { gte: il30j },
          ...versFilter,
        },
        select: {
          id: true, montant: true, datePaiement: true,
          souscription: { select: { client: { select: { pointDeVenteId: true } } } },
        },
      }),

      // Stocks des PDVs
      prisma.stockSite.findMany({
        where: stockPdvFilter,
        select: {
          quantite: true, alerteStock: true,
          pointDeVenteId: true,
          produit: { select: { id: true, nom: true, prixUnitaire: true, alerteStock: true } },
        },
      }),

      // Clôtures des 7 derniers jours (pour détecter clôtures manquantes)
      prisma.clotureCaisse.findMany({
        where: { date: { gte: il7j }, ...cloturePdvFilter },
        select: { date: true, pointDeVenteId: true, ecart: true, montantTotal: true, totalVentes: true, caissierNom: true },
        orderBy: { date: "desc" },
        take: 50,
      }),

      // Anomalies stock non résolues
      prisma.anomalieStock.count({
        where: {
          statut: { in: ["EN_ATTENTE", "EN_COURS"] },
          ...(pdvIds ? { pointDeVenteId: { in: pdvIds } } : {}),
        },
      }),

      // Réceptions en attente
      prisma.receptionApprovisionnement.count({
        where: {
          statut: { in: ["BROUILLON", "EN_COURS"] },
          ...(pdvIds ? { pointDeVenteId: { in: pdvIds } } : {}),
        },
      }),

      // Transferts inter-PDV (zone)
      prisma.transfertStock.count({
        where: {
          statut: "EXPEDIE",
          ...(pdvIds ? { OR: [{ origineId: { in: pdvIds } }, { destinationId: { in: pdvIds } }] } : {}),
        },
      }),

      // Ventes directes aujourd'hui
      prisma.venteDirecte.aggregate({
        _sum:   { montantPaye: true },
        _count: { id: true },
        where: {
          statut:    { notIn: ["BROUILLON", "ANNULEE"] },
          createdAt: { gte: startOfDay, lte: endOfDay },
          ...ventePdvFilter,
        },
      }),

      // Versements packs aujourd'hui
      prisma.versementPack.aggregate({
        _sum:   { montant: true },
        _count: { id: true },
        where: {
          datePaiement: { gte: startOfDay, lte: endOfDay },
          ...versFilter,
        },
      }),
    ]);

    // ── Calcul CA par PDV (30j) ────────────────────────────────────────────────
    const caParPdv: Record<number, number> = {};
    for (const v of ventesDir30j)  { caParPdv[v.pointDeVenteId] = (caParPdv[v.pointDeVenteId] ?? 0) + Number(v.montantPaye); }
    for (const v of versements30j) {
      const pdvId = v.souscription.client?.pointDeVenteId;
      if (pdvId) caParPdv[pdvId] = (caParPdv[pdvId] ?? 0) + Number(v.montant);
    }

    const ca30j     = Object.values(caParPdv).reduce((s, v) => s + v, 0);
    const caAujourd = Number(ventesAujourdhui._sum.montantPaye ?? 0) + Number(versemsAujourdhui._sum.montant ?? 0);

    // ── Stock alertes ─────────────────────────────────────────────────────────
    const stockParPdv: Record<number, { valeur: number; ruptures: number; faibles: number }> = {};
    for (const s of stockSites) {
      if (!stockParPdv[s.pointDeVenteId]) stockParPdv[s.pointDeVenteId] = { valeur: 0, ruptures: 0, faibles: 0 };
      const val = s.quantite * Number(s.produit.prixUnitaire);
      stockParPdv[s.pointDeVenteId].valeur += val;
      const seuil = s.alerteStock ?? s.produit.alerteStock;
      if (s.quantite === 0) stockParPdv[s.pointDeVenteId].ruptures++;
      else if (seuil > 0 && s.quantite <= seuil) stockParPdv[s.pointDeVenteId].faibles++;
    }
    const totalRuptures = Object.values(stockParPdv).reduce((s, p) => s + p.ruptures, 0);
    const totalFaibles  = Object.values(stockParPdv).reduce((s, p) => s + p.faibles, 0);
    const valeurStock   = Object.values(stockParPdv).reduce((s, p) => s + p.valeur, 0);

    // ── Clôtures manquantes (PDVs sans clôture hier) ──────────────────────────
    const hier = new Date(now); hier.setDate(now.getDate() - 1);
    const hierStr = hier.toISOString().split("T")[0];
    const cloturesHier = new Set(
      clotures7j
        .filter((c) => c.date.toISOString().split("T")[0] === hierStr)
        .map((c) => c.pointDeVenteId)
    );
    const pdvsActifs = pdvs.filter((p) => p.sessionsCaisse.length > 0 || p.type === "POINT_DE_VENTE");
    const cloturesManquantes = pdvsActifs.filter((p) => !cloturesHier.has(p.id)).length;

    // ── Alertes ───────────────────────────────────────────────────────────────
    const alertes: { type: "danger" | "warning" | "info"; message: string }[] = [];
    if (totalRuptures > 0)       alertes.push({ type: "danger",  message: `${totalRuptures} produit(s) en rupture de stock dans la zone` });
    if (totalFaibles > 0)        alertes.push({ type: "warning", message: `${totalFaibles} produit(s) avec stock faible dans la zone` });
    if (cloturesManquantes > 0)  alertes.push({ type: "danger",  message: `${cloturesManquantes} PDV(s) sans clôture de caisse hier` });
    if (anomaliesStock > 0)      alertes.push({ type: "warning", message: `${anomaliesStock} anomalie(s) de stock non résolue(s)` });
    if (receptions > 0)          alertes.push({ type: "info",    message: `${receptions} réception(s) d'approvisionnement en attente` });
    if (transfertsZone > 0)      alertes.push({ type: "info",    message: `${transfertsZone} transfert(s) stock en attente de réception` });

    // Clôtures avec écarts signifiants
    const ecarts = clotures7j.filter((c) => c.ecart && Math.abs(Number(c.ecart)) > 0);
    if (ecarts.length > 0) alertes.push({ type: "danger", message: `${ecarts.length} clôture(s) avec écart de caisse détecté` });

    // ── Top PDVs ──────────────────────────────────────────────────────────────
    const topPdvs = pdvs.map((p) => ({
      id:          p.id,
      nom:         p.nom,
      code:        p.code,
      type:        p.type,
      rpvNom:      p.rpv ? `${p.rpv.prenom} ${p.rpv.nom}` : null,
      ca30j:       caParPdv[p.id] ?? 0,
      caissOuverte: p.sessionsCaisse.length > 0,
      stock:       stockParPdv[p.id] ?? { valeur: 0, ruptures: 0, faibles: 0 },
    })).sort((a, b) => b.ca30j - a.ca30j);

    // ── Dernières clôtures ────────────────────────────────────────────────────
    const derniersClotures = clotures7j.slice(0, 10).map((c) => ({
      date:         c.date.toISOString(),
      pdvId:        c.pointDeVenteId,
      pdvNom:       pdvs.find((p) => p.id === c.pointDeVenteId)?.nom ?? "—",
      caissierNom:  c.caissierNom,
      totalVentes:  c.totalVentes,
      montantTotal: Number(c.montantTotal),
      ecart:        c.ecart ? Number(c.ecart) : 0,
      hasEcart:     c.ecart ? Number(c.ecart) !== 0 : false,
    }));

    return NextResponse.json({
      success: true,
      data: {
        zone: {
          nbPdvs:   pdvs.length,
          nbAgents: agentsCount,
          nbClients: clientsCount,
        },
        ca: {
          aujourd:  caAujourd,
          mois30j:  ca30j,
          ventesDir:   { count: ventesDir30j.length,    montant: ventesDir30j.reduce((s, v)  => s + Number(v.montantPaye), 0) },
          versements:  { count: versements30j.length,   montant: versements30j.reduce((s, v) => s + Number(v.montant), 0) },
        },
        stock: {
          valeur:   valeurStock,
          ruptures: totalRuptures,
          faibles:  totalFaibles,
        },
        alertes,
        anomalies: { stock: anomaliesStock },
        topPdvs,
        derniersClotures,
        divers: {
          receptionsAttente: receptions,
          transfertsAttente: transfertsZone,
          cloturesManquantes,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/dashboard error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
