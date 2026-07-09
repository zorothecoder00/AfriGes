import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayRange = { gte: today, lt: tomorrow };

    const [
      versementsAujourdhui,
      souscriptionsAujourdhui,
      ventesAujourdhui,
      mouvementsAujourdhui,
      modules,
      stockAlerts,
      sessionsCaisseOuvertes,
      approsEnAttente,
      versementsMontant,
      ventesMontant,
      remboursementsMontant,
      ventesCashAgg,
      remboursementsAujourdhui,
    ] = await Promise.all([
      // Activité du jour
      prisma.versementPack.count({ where: { createdAt: todayRange } }),
      prisma.souscriptionPack.count({ where: { createdAt: todayRange } }),
      prisma.venteDirecte.count({ where: { createdAt: todayRange } }),
      prisma.mouvementStock.count({ where: { dateMouvement: todayRange } }),

      // Modules
      prisma.systemModule.findMany({ orderBy: { nom: "asc" } }),

      // Stock en alerte (quantite <= seuil, ruptures à 0 INCLUSES).
      // Pas de filtre `quantite > 0` : sinon les ruptures totales — les plus
      // critiques — seraient exclues de l'alerte.
      prisma.stockSite.findMany({
        include: {
          produit: { select: { nom: true, alerteStock: true } },
          pointDeVente: { select: { nom: true } },
        },
      }),

      // Sessions caisse ouvertes
      prisma.sessionCaisse.count({ where: { statut: "OUVERTE" } }),

      // Appros en attente (BROUILLON)
      prisma.receptionApprovisionnement.count({ where: { statut: "BROUILLON" } }),

      // Montant versements packs du jour
      prisma.versementPack.aggregate({
        where: { createdAt: todayRange },
        _sum: { montant: true },
      }),

      // Montant ventes du jour (total commercial)
      prisma.venteDirecte.aggregate({
        where: { createdAt: todayRange },
        _sum: { montantTotal: true },
      }),

      // Remboursements crédits du jour (pour l'encaissé réel)
      prisma.remboursementCredit.aggregate({
        where: { dateRemboursement: todayRange },
        _sum: { montant: true },
      }),

      // Ventes directes du jour — cash net encaissé (payé − monnaie rendue)
      prisma.venteDirecte.aggregate({
        where: { createdAt: todayRange, statut: { notIn: ["ANNULEE", "BROUILLON"] } },
        _sum: { montantPaye: true, monnaieRendue: true },
      }),

      // Remboursements crédits reçus du jour (activité du jour)
      prisma.remboursementCredit.count({ where: { dateRemboursement: todayRange } }),
    ]);

    // Encaissé réel du jour = versements packs + remboursements crédits + ventes (cash net).
    const encaisseJour =
      Number(versementsMontant._sum.montant ?? 0) +
      Number(remboursementsMontant._sum.montant ?? 0) +
      Math.max(0, Number(ventesCashAgg._sum.montantPaye ?? 0) - Number(ventesCashAgg._sum.monnaieRendue ?? 0));

    // Filtrer les stocks vraiment en alerte en JS :
    //  - rupture totale (quantite <= 0) : toujours alertée, même sans seuil défini ;
    //  - stock faible : quantite <= seuil d'alerte du produit.
    const alertesStock = stockAlerts.filter(
      (s) => s.quantite <= 0 || (s.produit.alerteStock !== null && s.quantite <= s.produit.alerteStock)
    );
    const ruptures = alertesStock.filter((s) => s.quantite <= 0);

    const modulesActifs   = modules.filter((m) => m.actif).length;
    const modulesInactifs = modules.filter((m) => !m.actif).length;

    // Alertes opérationnelles
    const alertes = [];
    if (alertesStock.length > 0) {
      alertes.push({
        type: "stock",
        niveau: ruptures.length > 0 || alertesStock.length > 5 ? "critique" : "warning",
        alertKey: "alert_low_stock",
        count: alertesStock.length,
        detail: [
          ruptures.length > 0 ? `${ruptures.length} rupture(s)` : null,
          alertesStock.slice(0, 3).map((s) => `${s.produit.nom} (${s.pointDeVente.nom})`).join(", "),
        ].filter(Boolean).join(" · "),
      });
    }
    if (approsEnAttente > 0) {
      alertes.push({
        type: "appro",
        niveau: "info",
        alertKey: "alert_appro_pending",
        count: approsEnAttente,
        detail: "",
      });
    }
    if (sessionsCaisseOuvertes > 3) {
      alertes.push({
        type: "caisse",
        niveau: "info",
        alertKey: "alert_sessions_open",
        count: sessionsCaisseOuvertes,
        detail: "",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        activiteJour: {
          versements: versementsAujourdhui,
          souscriptions: souscriptionsAujourdhui,
          ventes: ventesAujourdhui,
          remboursements: remboursementsAujourdhui,
          mouvementsStock: mouvementsAujourdhui,
        },
        modules: {
          actifs: modulesActifs,
          inactifs: modulesInactifs,
          total: modules.length,
          liste: modules.map((m) => ({ nom: m.nom, key: m.key, actif: m.actif })),
        },
        alertes,
        rapports: {
          caisse: {
            sessionsOuvertes: sessionsCaisseOuvertes,
            // Encaissé réel du jour (packs + remboursements crédits + ventes cash net).
            versementsMontant: encaisseJour,
          },
          stock: {
            alertes: alertesStock.length,
          },
          ventes: {
            count: ventesAujourdhui,
            montant: Number(ventesMontant._sum.montantTotal ?? 0),
          },
          approvisionnement: {
            enAttente: approsEnAttente,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET /api/admin/activity", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
