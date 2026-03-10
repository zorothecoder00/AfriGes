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
    ] = await Promise.all([
      // Activité du jour
      prisma.versementPack.count({ where: { createdAt: todayRange } }),
      prisma.souscriptionPack.count({ where: { createdAt: todayRange } }),
      prisma.venteDirecte.count({ where: { createdAt: todayRange } }),
      prisma.mouvementStock.count({ where: { dateMouvement: todayRange } }),

      // Modules
      prisma.systemModule.findMany({ orderBy: { nom: "asc" } }),

      // Stock en alerte (quantite <= alerte seuil)
      prisma.stockSite.findMany({
        where: { quantite: { gt: 0 } },
        include: {
          produit: { select: { nom: true, alerteStock: true } },
          pointDeVente: { select: { nom: true } },
        },
      }),

      // Sessions caisse ouvertes
      prisma.sessionCaisse.count({ where: { statut: "OUVERTE" } }),

      // Appros en attente (BROUILLON)
      prisma.receptionApprovisionnement.count({ where: { statut: "BROUILLON" } }),

      // Montant versements du jour
      prisma.versementPack.aggregate({
        where: { createdAt: todayRange },
        _sum: { montant: true },
      }),

      // Montant ventes du jour
      prisma.venteDirecte.aggregate({
        where: { createdAt: todayRange },
        _sum: { montantTotal: true },
      }),
    ]);

    // Filtrer les stocks vraiment en alerte en JS
    const alertesStock = stockAlerts.filter(
      (s) => s.produit.alerteStock !== null && s.quantite <= s.produit.alerteStock
    );

    const modulesActifs   = modules.filter((m) => m.actif).length;
    const modulesInactifs = modules.filter((m) => !m.actif).length;

    // Alertes opérationnelles
    const alertes = [];
    if (alertesStock.length > 0) {
      alertes.push({
        type: "stock",
        niveau: alertesStock.length > 5 ? "critique" : "warning",
        message: `${alertesStock.length} produit(s) en dessous du seuil d'alerte`,
        detail: alertesStock.slice(0, 3).map((s) => `${s.produit.nom} (${s.pointDeVente.nom})`).join(", "),
      });
    }
    if (approsEnAttente > 0) {
      alertes.push({
        type: "appro",
        niveau: "info",
        message: `${approsEnAttente} réception(s) d'approvisionnement en attente`,
        detail: "",
      });
    }
    if (sessionsCaisseOuvertes > 3) {
      alertes.push({
        type: "caisse",
        niveau: "info",
        message: `${sessionsCaisseOuvertes} session(s) de caisse ouvertes`,
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
            versementsMontant: Number(versementsMontant._sum.montant ?? 0),
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
