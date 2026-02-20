import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";

/**
 * GET /api/caissier/dashboard
 *
 * Tableau de bord temps réel du caissier :
 *  - Stats du jour (ventes, CA, panier moyen, clients servis)
 *  - État du stock (faible, rupture, valeur totale)
 *  - Crédits alimentaires actifs
 *  - Dernière clôture connue
 *  - Évolution des ventes par heure (graphique)
 *  - 5 dernières ventes
 *  - Alertes prioritaires
 */
export async function GET() {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // ── Requêtes parallèles ────────────────────────────────────────────────
    const [ventesAujourdhui, produits, creditsAlimActifs, derniereCloture] =
      await Promise.all([

        prisma.venteCreditAlimentaire.findMany({
          where: { createdAt: { gte: startOfDay, lte: endOfDay } },
          select: {
            id: true,
            quantite: true,
            prixUnitaire: true,
            createdAt: true,
            produit: { select: { id: true, nom: true } },
            creditAlimentaire: {
              select: {
                member: { select: { id: true, nom: true, prenom: true } },
                client: { select: { id: true, nom: true, prenom: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),

        prisma.produit.findMany({
          select: {
            id: true,
            nom: true,
            stock: true,
            alerteStock: true,
            prixUnitaire: true,
          },
        }),

        prisma.creditAlimentaire.count({ where: { statut: "ACTIF" } }),

        prisma.clotureCaisse.findFirst({ orderBy: { date: "desc" } }),
      ]);

    // ── Stats ventes du jour ───────────────────────────────────────────────
    const totalVentes   = ventesAujourdhui.length;
    const montantTotal  = ventesAujourdhui.reduce(
      (s, v) => s + Number(v.prixUnitaire) * v.quantite, 0
    );
    const panierMoyen   = totalVentes > 0 ? montantTotal / totalVentes : 0;

    // Clients distincts servis aujourd'hui
    const creditIdsVus = new Set(
      ventesAujourdhui
        .map((v) => v.creditAlimentaire)
        .filter(Boolean)
        .map((ca) => (ca!.member?.id ?? ca!.client?.id ?? 0))
    );
    const nbClients = creditIdsVus.size;

    // ── Stats stock ────────────────────────────────────────────────────────
    const stockFaible = produits.filter((p) => p.stock > 0 && p.stock <= p.alerteStock).length;
    const enRupture   = produits.filter((p) => p.stock === 0).length;
    const valeurStock = produits.reduce((s, p) => s + Number(p.prixUnitaire) * p.stock, 0);

    // ── Alertes ────────────────────────────────────────────────────────────
    const alertes: { type: "danger" | "warning" | "info"; message: string }[] = [];
    if (enRupture > 0)   alertes.push({ type: "danger",  message: `${enRupture} produit(s) en rupture de stock` });
    if (stockFaible > 0) alertes.push({ type: "warning", message: `${stockFaible} produit(s) avec stock faible` });
    if (creditsAlimActifs === 0)
      alertes.push({ type: "info", message: "Aucun crédit alimentaire actif disponible" });

    // ── Évolution ventes par heure ─────────────────────────────────────────
    const evolution = Array.from({ length: 24 }, (_, h) => {
      const hVentes = ventesAujourdhui.filter(
        (v) => new Date(v.createdAt).getHours() === h
      );
      return {
        heure: h,
        count:   hVentes.length,
        montant: hVentes.reduce((s, v) => s + Number(v.prixUnitaire) * v.quantite, 0),
      };
    });

    // ── Dernières ventes (5) ───────────────────────────────────────────────
    const dernieresVentes = ventesAujourdhui.slice(0, 5).map((v) => {
      const person = v.creditAlimentaire?.client ?? v.creditAlimentaire?.member;
      return {
        id: v.id,
        produitNom: v.produit.nom,
        quantite:   v.quantite,
        montant:    Number(v.prixUnitaire) * v.quantite,
        clientNom:  person ? `${person.prenom} ${person.nom}` : "—",
        heure:      new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        today: {
          date:       now.toISOString(),
          startOfDay: startOfDay.toISOString(),
        },
        ventes: {
          total:      totalVentes,
          montant:    montantTotal,
          panierMoyen,
          nbClients,
        },
        stock: {
          total:        produits.length,
          faible:       stockFaible,
          rupture:      enRupture,
          valeur:       valeurStock,
          produitsAlerte: produits
            .filter((p) => p.stock <= p.alerteStock)
            .map((p) => ({ id: p.id, nom: p.nom, stock: p.stock, alerteStock: p.alerteStock })),
        },
        creditsAlimActifs,
        derniereCloture: derniereCloture
          ? {
              ...derniereCloture,
              date:         derniereCloture.date.toISOString(),
              montantTotal: Number(derniereCloture.montantTotal),
              panierMoyen:  Number(derniereCloture.panierMoyen),
            }
          : null,
        alertes,
        evolution,
        dernieresVentes,
      },
    });
  } catch (error) {
    console.error("CAISSIER DASHBOARD ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
