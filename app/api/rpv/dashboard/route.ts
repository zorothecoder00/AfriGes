import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/dashboard
 *
 * Tableau de bord agrégé du Responsable PDV :
 *  - CA jour / semaine / mois (VersementPack)
 *  - Top produits livrés (LigneReceptionPack → statut LIVREE, 30j)
 *  - État complet du stock + alertes
 *  - Livraisons en cours / à venir
 *  - Sessions caisses ouvertes
 *  - Dernières clôtures de caisse
 *  - Mouvements de stock récents
 *  - Activités récentes (AuditLog)
 *  - KPIs équipe (nbre par rôle)
 */
export async function GET() {
  try {
    const session = await getRPVSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const now         = new Date();
    const startOfDay  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const il7j  = new Date(now); il7j.setDate(now.getDate() - 7);
    const il30j = new Date(now); il30j.setDate(now.getDate() - 30);

    const [
      versementsJour,
      versementsSemaine,
      versementsMois,
      produits,
      livraisonsActives,
      derniereCloture,
      mouvementsRecents,
      equipeStats,
      sessionsCaisses,
      activitesRecentes,
      lignesGrouped,
    ] = await Promise.all([

      // Versements du jour
      prisma.versementPack.findMany({
        where:   { createdAt: { gte: startOfDay, lte: endOfDay } },
        select:  {
          id: true, montant: true, type: true, createdAt: true,
          souscription: {
            select: {
              pack:   { select: { nom: true } },
              user:   { select: { nom: true, prenom: true } },
              client: { select: { nom: true, prenom: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Versements semaine (7 derniers jours)
      prisma.versementPack.aggregate({
        where: { createdAt: { gte: startOfWeek } },
        _sum: { montant: true },
        _count: { id: true },
      }),

      // Versements mois en cours
      prisma.versementPack.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { montant: true },
        _count: { id: true },
      }),

      // Tous les produits pour stats (avec stock par site)
      prisma.produit.findMany({
        select: { id: true, nom: true, alerteStock: true, prixUnitaire: true, stocks: { select: { quantite: true } } },
      }),

      // Réceptions actives (BROUILLON ou EN_COURS)
      prisma.receptionApprovisionnement.findMany({
        where:   { statut: { in: ["BROUILLON", "EN_COURS"] } },
        select:  {
          id: true, reference: true, type: true, statut: true,
          fournisseurNom: true, origineNom: true,
          datePrevisionnelle: true,
          lignes: { select: { id: true } },
        },
        orderBy: { datePrevisionnelle: "asc" },
        take: 5,
      }),

      // Dernière clôture caisse
      prisma.clotureCaisse.findFirst({ orderBy: { date: "desc" } }),

      // Derniers mouvements de stock (7j)
      prisma.mouvementStock.findMany({
        where:   { dateMouvement: { gte: il7j } },
        select:  { id: true, type: true, quantite: true, motif: true, dateMouvement: true, produit: { select: { nom: true } } },
        orderBy: { dateMouvement: "desc" },
        take: 6,
      }),

      // Stats équipe par rôle
      prisma.gestionnaire.groupBy({
        by: ["role"], _count: { id: true }, where: { actif: true },
      }),

      // Sessions caisses ouvertes
      prisma.sessionCaisse.findMany({
        where:   { statut: { in: ["OUVERTE", "SUSPENDUE"] } },
        select:  { id: true, caissierNom: true, statut: true, dateOuverture: true, fondsCaisse: true },
        orderBy: { dateOuverture: "desc" },
      }),

      // Activités récentes (AuditLog)
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true, action: true, entite: true, entiteId: true, createdAt: true,
          user: { select: { nom: true, prenom: true } },
        },
      }),

      // Top produits livrés (30j) — regroupement par produitId
      prisma.ligneReceptionPack.groupBy({
        by: ["produitId"],
        where: { reception: { statut: "LIVREE", dateLivraison: { gte: il30j } } },
        _sum:   { quantite: true },
        _count: { id: true },
        orderBy: { _sum: { quantite: "desc" } },
        take: 5,
      }),

    ]);

    // Récupérer les noms des top produits
    const topProduitIds = lignesGrouped.map((g) => g.produitId);
    const topProduitsInfo = topProduitIds.length
      ? await prisma.produit.findMany({
          where:  { id: { in: topProduitIds } },
          select: { id: true, nom: true },
        })
      : [];

    const topProduitsLivres = lignesGrouped.map((g) => {
      const prod = topProduitsInfo.find((p) => p.id === g.produitId);
      return {
        produitId:    g.produitId,
        nom:          prod?.nom ?? "—",
        quantite:     g._sum.quantite ?? 0,
        nbLivraisons: g._count.id,
      };
    });

    // ── Stats versements du jour ─────────────────────────────────────────────
    const caJour      = versementsJour.reduce((s, v) => s + Number(v.montant), 0);
    const nbVentes    = versementsJour.length;
    const panierMoyen = nbVentes > 0 ? caJour / nbVentes : 0;

    // ── Stats stock ──────────────────────────────────────────────────────────
    const produitsAvecStock = produits.map((p) => ({
      ...p,
      totalStock: p.stocks.reduce((s, ss) => s + ss.quantite, 0),
    }));
    const enRupture       = produitsAvecStock.filter((p) => p.totalStock === 0).length;
    const stockFaible     = produitsAvecStock.filter((p) => p.totalStock > 0 && p.totalStock <= p.alerteStock).length;
    const valeurStock     = produitsAvecStock.reduce((s, p) => s + Number(p.prixUnitaire) * p.totalStock, 0);
    const alertesProduits = produitsAvecStock
      .filter((p) => p.totalStock <= p.alerteStock)
      .sort((a, b) => a.totalStock - b.totalStock)
      .map((p) => ({ id: p.id, nom: p.nom, stock: p.totalStock, alerteStock: p.alerteStock }));

    // ── Evolution versements par heure ───────────────────────────────────────
    const ventesParHeure = Array.from({ length: 24 }, (_, h) => {
      const hvs = versementsJour.filter((v) => new Date(v.createdAt).getHours() === h);
      return { heure: h, count: hvs.length, montant: hvs.reduce((s, v) => s + Number(v.montant), 0) };
    });

    // ── Équipe stats ─────────────────────────────────────────────────────────
    const equipePDV: Record<string, number> = {};
    for (const g of equipeStats) equipePDV[g.role] = g._count.id;

    return NextResponse.json({
      success: true,
      data: {
        today: { date: now.toISOString() },
        ventes: {
          total: nbVentes, montant: caJour, panierMoyen,
          semaine: {
            total:   versementsSemaine._count.id,
            montant: Number(versementsSemaine._sum.montant ?? 0),
          },
          mois: {
            total:   versementsMois._count.id,
            montant: Number(versementsMois._sum.montant ?? 0),
          },
          recentes: versementsJour.slice(0, 5).map((v) => {
            const person = v.souscription?.user ?? v.souscription?.client;
            return {
              id:         v.id,
              produitNom: v.souscription?.pack.nom ?? "—",
              quantite:   1,
              montant:    Number(v.montant),
              clientNom:  person ? `${person.prenom} ${person.nom}` : "—",
              heure:      new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            };
          }),
          evolution: ventesParHeure,
        },
        stock: {
          total: produitsAvecStock.length, enRupture, stockFaible, valeurStock, alertesProduits,
        },
        livraisons: {
          brouillon: livraisonsActives.filter((l) => l.statut === "BROUILLON").length,
          enCours:   livraisonsActives.filter((l) => l.statut === "EN_COURS").length,
          prochaines: livraisonsActives.map((l) => ({
            id: l.id, reference: l.reference, type: l.type, statut: l.statut,
            partieNom: l.fournisseurNom ?? l.origineNom ?? "—",
            datePrevisionnelle: l.datePrevisionnelle.toISOString(),
            nbLignes: l.lignes.length,
          })),
        },
        derniereCloture: derniereCloture ? {
          ...derniereCloture,
          date:         derniereCloture.date.toISOString(),
          montantTotal: Number(derniereCloture.montantTotal),
          panierMoyen:  Number(derniereCloture.panierMoyen),
        } : null,
        mouvementsRecents: mouvementsRecents.map((m) => ({
          ...m, dateMouvement: m.dateMouvement.toISOString(), produitNom: m.produit.nom,
        })),
        equipe: equipePDV,
        sessionsCaisses: sessionsCaisses.map((s) => ({
          id: s.id, caissierNom: s.caissierNom, statut: s.statut,
          dateOuverture: s.dateOuverture.toISOString(),
          fondsCaisse:   Number(s.fondsCaisse),
        })),
        topProduitsLivres,
        activitesRecentes: activitesRecentes.map((a) => ({
          id: a.id, action: a.action, entite: a.entite, entiteId: a.entiteId,
          createdAt: a.createdAt.toISOString(),
          userNom: a.user ? `${a.user.prenom} ${a.user.nom}` : "Système",
        })),
      },
    });
  } catch (error) {
    console.error("RPV DASHBOARD ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
