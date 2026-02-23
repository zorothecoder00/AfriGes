import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

export async function GET() {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalAuditLogs,
      actionsToday,
      suppressionsAujourdhui,
      produits,
      ventesRecentes,
      creditsAlimGrouped,
      cotisationsGrouped,
      tontinesGrouped,
      livraisonsGrouped,
      livraisonsEnRetardCount,
      livraisonsRecentes,
      cloturesRecentes,
      gestionnaireActifsCount,
      auditCountByUser,
      auditLastByUser,
    ] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: startOfToday } } }),

      // Opérations de suppression aujourd'hui — indicateur de fraude potentielle
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startOfToday },
          OR: [
            { action: { contains: "supprim", mode: "insensitive" } },
            { action: { contains: "DELETE", mode: "insensitive" } },
            { action: { contains: "annul", mode: "insensitive" } },
          ],
        },
      }),

      // Tous les produits pour audit stock
      prisma.produit.findMany({ orderBy: [{ stock: "asc" }, { nom: "asc" }] }),

      // Ventes 30 derniers jours avec produit pour vérification de prix
      prisma.venteCreditAlimentaire.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: {
          produit: { select: { id: true, nom: true, prixUnitaire: true } },
          creditAlimentaire: {
            include: {
              member: { select: { id: true, nom: true, prenom: true } },
              client: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.creditAlimentaire.groupBy({
        by: ["statut"],
        _count: { id: true },
        _sum: { plafond: true, montantUtilise: true, montantRestant: true },
      }),

      prisma.cotisation.groupBy({
        by: ["statut"],
        _count: { id: true },
        _sum: { montant: true },
      }),

      prisma.tontine.groupBy({
        by: ["statut"],
        _count: { id: true },
      }),

      prisma.livraison.groupBy({
        by: ["statut"],
        _count: { id: true },
      }),

      // Livraisons ayant dépassé leur date prévisionnelle sans être livrées
      prisma.livraison.count({
        where: {
          datePrevisionnelle: { lt: now },
          statut: { in: ["EN_ATTENTE", "EN_COURS"] },
        },
      }),

      prisma.livraison.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        include: {
          lignes: {
            include: { produit: { select: { id: true, nom: true } } },
          },
        },
      }),

      // Clôtures de caisse des 10 derniers jours
      prisma.clotureCaisse.findMany({
        where: { date: { gte: sevenDaysAgo } },
        orderBy: { date: "desc" },
        take: 10,
      }),

      prisma.gestionnaire.count({ where: { actif: true } }),

      // Activité des utilisateurs dans les 7 derniers jours
      prisma.auditLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: sevenDaysAgo }, userId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),

      prisma.auditLog.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: sevenDaysAgo }, userId: { not: null } },
        _max: { createdAt: true },
      }),
    ]);

    // ── Stock ─────────────────────────────────────────────────────────────────
    const enRupture = produits.filter((p) => p.stock === 0).length;
    const stockFaible = produits.filter(
      (p) => p.stock > 0 && p.alerteStock > 0 && p.stock <= p.alerteStock
    ).length;
    const valeurTotale = produits.reduce(
      (sum, p) => sum + Number(p.prixUnitaire) * p.stock,
      0
    );

    // ── Ventes ────────────────────────────────────────────────────────────────
    const montantTotal30j = ventesRecentes.reduce(
      (sum, v) => sum + Number(v.prixUnitaire) * v.quantite,
      0
    );

    // Détection : prix de vente ≠ prix catalogue (tolérance 0.1%)
    const anomaliesPrix = ventesRecentes.filter((v) => {
      const pv = Number(v.prixUnitaire);
      const pc = Number(v.produit.prixUnitaire);
      return pc > 0 && Math.abs(pv - pc) / pc > 0.001;
    });

    // ── Finances helpers ──────────────────────────────────────────────────────
    const credActifs = creditsAlimGrouped.find((g) => g.statut === "ACTIF");
    const credEpuises = creditsAlimGrouped.find((g) => g.statut === "EPUISE");
    const credExpires = creditsAlimGrouped.find((g) => g.statut === "EXPIRE");
    const montantTotalCred = creditsAlimGrouped.reduce(
      (s, g) => s + Number(g._sum?.plafond ?? 0),
      0
    );
    const montantUtiliseCred = creditsAlimGrouped.reduce(
      (s, g) => s + Number(g._sum?.montantUtilise ?? 0),
      0
    );
    const montantRestantCred = creditsAlimGrouped.reduce(
      (s, g) => s + Number(g._sum?.montantRestant ?? 0),
      0
    );

    const cotPayees = cotisationsGrouped.find((g) => g.statut === "PAYEE");
    const cotEnAttente = cotisationsGrouped.find((g) => g.statut === "EN_ATTENTE");
    const cotExpirees = cotisationsGrouped.find((g) => g.statut === "EXPIREE");
    const montantTotalCot = cotisationsGrouped.reduce(
      (s, g) => s + Number(g._sum?.montant ?? 0),
      0
    );

    const tontinesActives =
      tontinesGrouped.find((g) => g.statut === "ACTIVE")?._count?.id ?? 0;
    const tontinesTerminees =
      tontinesGrouped.find((g) => g.statut === "TERMINEE")?._count?.id ?? 0;

    // ── Livraisons stats map ──────────────────────────────────────────────────
    const livraisonsStats: Record<string, number> = {};
    livraisonsGrouped.forEach((g) => {
      livraisonsStats[g.statut] = g._count.id;
    });

    // ── Clôtures caisse manquantes ────────────────────────────────────────────
    const clotureDatesSet = new Set(
      cloturesRecentes.map((c) => {
        const d = new Date(c.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })
    );
    const joursManquants: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!clotureDatesSet.has(key)) joursManquants.push(key);
    }

    // ── Construction liste des anomalies ──────────────────────────────────────
    type NiveauAnomalie = "CRITIQUE" | "HAUTE" | "MOYENNE" | "BASSE";
    const anomalies: Array<{
      type: string;
      niveau: NiveauAnomalie;
      description: string;
      entite: string;
      entiteId?: number;
    }> = [];

    // Ruptures de stock
    produits
      .filter((p) => p.stock === 0)
      .forEach((p) =>
        anomalies.push({
          type: "STOCK_RUPTURE",
          niveau: "CRITIQUE",
          description: `${p.nom} — rupture totale de stock`,
          entite: "Produit",
          entiteId: p.id,
        })
      );

    // Stock faible
    produits
      .filter((p) => p.stock > 0 && p.alerteStock > 0 && p.stock <= p.alerteStock)
      .forEach((p) =>
        anomalies.push({
          type: "STOCK_FAIBLE",
          niveau: "HAUTE",
          description: `${p.nom} — stock critique (${p.stock} unités, seuil: ${p.alerteStock})`,
          entite: "Produit",
          entiteId: p.id,
        })
      );

    // Prix de vente anormaux
    if (anomaliesPrix.length > 0) {
      anomalies.push({
        type: "PRIX_ANORMAL",
        niveau: "HAUTE",
        description: `${anomaliesPrix.length} vente(s) avec prix différent du catalogue ce mois-ci`,
        entite: "Vente",
      });
    }

    // Livraisons en retard
    if (livraisonsEnRetardCount > 0) {
      anomalies.push({
        type: "LIVRAISON_RETARD",
        niveau: livraisonsEnRetardCount >= 3 ? "CRITIQUE" : "HAUTE",
        description: `${livraisonsEnRetardCount} livraison(s) dépassent leur date prévisionnelle`,
        entite: "Livraison",
      });
    }

    // Clôtures de caisse manquantes
    if (joursManquants.length > 0) {
      anomalies.push({
        type: "CLOTURE_MANQUANTE",
        niveau: joursManquants.length >= 3 ? "CRITIQUE" : "HAUTE",
        description: `${joursManquants.length} jour(s) sans clôture de caisse (7 derniers jours)`,
        entite: "ClotureCaisse",
      });
    }

    // Suppressions en masse aujourd'hui
    if (suppressionsAujourdhui >= 3) {
      anomalies.push({
        type: "SUPPRESSIONS_MASSIVES",
        niveau: suppressionsAujourdhui >= 6 ? "CRITIQUE" : "HAUTE",
        description: `${suppressionsAujourdhui} opération(s) de suppression/annulation aujourd'hui`,
        entite: "AuditLog",
      });
    }

    // Cotisations expirées
    const cotExpCount = cotExpirees?._count?.id ?? 0;
    if (cotExpCount > 3) {
      anomalies.push({
        type: "COTISATIONS_EXPIREES",
        niveau: cotExpCount > 15 ? "HAUTE" : "MOYENNE",
        description: `${cotExpCount} cotisation(s) expirée(s) sans règlement`,
        entite: "Cotisation",
      });
    }

    // Crédits alimentaires tous épuisés
    const credEpuisesCount = credEpuises?._count?.id ?? 0;
    if (credEpuisesCount > 10) {
      anomalies.push({
        type: "CREDITS_EPUISES",
        niveau: "MOYENNE",
        description: `${credEpuisesCount} crédit(s) alimentaire(s) épuisé(s)`,
        entite: "CreditAlimentaire",
      });
    }

    // Tri par sévérité
    const niveauOrder: Record<NiveauAnomalie, number> = {
      CRITIQUE: 0,
      HAUTE: 1,
      MOYENNE: 2,
      BASSE: 3,
    };
    anomalies.sort(
      (a, b) =>
        (niveauOrder[a.niveau as NiveauAnomalie] ?? 4) -
        (niveauOrder[b.niveau as NiveauAnomalie] ?? 4)
    );

    // ── Score de conformité ───────────────────────────────────────────────────
    const nCritique = anomalies.filter((a) => a.niveau === "CRITIQUE").length;
    const nHaute = anomalies.filter((a) => a.niveau === "HAUTE").length;
    const nMoyenne = anomalies.filter((a) => a.niveau === "MOYENNE").length;
    const nBasse = anomalies.filter((a) => a.niveau === "BASSE").length;
    const scoreConformite = Math.max(
      0,
      Math.min(100, 100 - nCritique * 15 - nHaute * 8 - nMoyenne * 3 - nBasse * 1)
    );

    // ── Activité gestionnaires ────────────────────────────────────────────────
    const countMap: Record<number, number> = {};
    auditCountByUser.forEach((g) => {
      if (g.userId) countMap[g.userId] = g._count.id;
    });
    const lastMap: Record<number, string> = {};
    auditLastByUser.forEach((g) => {
      if (g.userId && g._max.createdAt)
        lastMap[g.userId] = (g._max.createdAt as Date).toISOString();
    });

    const topUserIds = auditCountByUser
      .map((g) => g.userId)
      .filter(Boolean) as number[];
    const topGestionnaires =
      topUserIds.length > 0
        ? await prisma.gestionnaire.findMany({
            where: { memberId: { in: topUserIds } },
            include: { member: { select: { id: true, nom: true, prenom: true } } },
          })
        : [];

    const gestionnaireActivite = topGestionnaires
      .map((g) => ({
        id: g.id,
        nom: g.member.nom,
        prenom: g.member.prenom,
        role: g.role,
        actionsCount: countMap[g.member.id] ?? 0,
        derniereAction: lastMap[g.member.id] ?? null,
      }))
      .sort((a, b) => b.actionsCount - a.actionsCount);

    // ── Réponse ───────────────────────────────────────────────────────────────
    return NextResponse.json({
      stats: {
        totalAuditLogs,
        actionsToday,
        anomaliesCount: anomalies.length,
        scoreConformite,
        gestionnaireActifs: gestionnaireActifsCount,
      },
      anomalies,
      stock: {
        totalProduits: produits.length,
        enRupture,
        stockFaible,
        valeurTotale,
        produits: produits.map((p) => ({
          id: p.id,
          nom: p.nom,
          prixUnitaire: p.prixUnitaire.toString(),
          stock: p.stock,
          alerteStock: p.alerteStock,
        })),
      },
      ventes: {
        totalCe30Jours: ventesRecentes.length,
        montantTotal30Jours: montantTotal30j,
        anomaliesPrix: anomaliesPrix.slice(0, 20).map((v) => ({
          id: v.id,
          produitNom: v.produit.nom,
          prixVente: v.prixUnitaire.toString(),
          prixCatalogue: v.produit.prixUnitaire.toString(),
          quantite: v.quantite,
          createdAt: v.createdAt.toISOString(),
          client: v.creditAlimentaire.member
            ? `${v.creditAlimentaire.member.prenom} ${v.creditAlimentaire.member.nom}`
            : v.creditAlimentaire.client
            ? `${v.creditAlimentaire.client.prenom} ${v.creditAlimentaire.client.nom}`
            : "Inconnu",
        })),
        recentes: ventesRecentes.slice(0, 25).map((v) => ({
          id: v.id,
          produitNom: v.produit.nom,
          quantite: v.quantite,
          prixUnitaire: v.prixUnitaire.toString(),
          prixCatalogue: v.produit.prixUnitaire.toString(),
          montant: (Number(v.prixUnitaire) * v.quantite).toString(),
          createdAt: v.createdAt.toISOString(),
          client: v.creditAlimentaire.member
            ? `${v.creditAlimentaire.member.prenom} ${v.creditAlimentaire.member.nom}`
            : v.creditAlimentaire.client
            ? `${v.creditAlimentaire.client.prenom} ${v.creditAlimentaire.client.nom}`
            : "Inconnu",
          hasAnomalie: (() => {
            const pv = Number(v.prixUnitaire);
            const pc = Number(v.produit.prixUnitaire);
            return pc > 0 && Math.abs(pv - pc) / pc > 0.001;
          })(),
        })),
      },
      livraisons: {
        stats: livraisonsStats,
        enRetard: livraisonsEnRetardCount,
        recentes: livraisonsRecentes.map((l) => ({
          id: l.id,
          reference: l.reference,
          type: l.type,
          statut: l.statut,
          fournisseurNom: l.fournisseurNom,
          destinataireNom: l.destinataireNom,
          datePrevisionnelle: l.datePrevisionnelle.toISOString(),
          dateLivraison: l.dateLivraison?.toISOString() ?? null,
          planifiePar: l.planifiePar,
          isEnRetard:
            l.datePrevisionnelle < now &&
            ["EN_ATTENTE", "EN_COURS"].includes(l.statut),
          nbLignes: l.lignes.length,
        })),
      },
      clotureCaisse: {
        derniere: cloturesRecentes[0]
          ? {
              id: cloturesRecentes[0].id,
              date: cloturesRecentes[0].date.toISOString(),
              caissierNom: cloturesRecentes[0].caissierNom,
              totalVentes: cloturesRecentes[0].totalVentes,
              montantTotal: cloturesRecentes[0].montantTotal.toString(),
              panierMoyen: cloturesRecentes[0].panierMoyen.toString(),
              nbClients: cloturesRecentes[0].nbClients,
              notes: cloturesRecentes[0].notes,
            }
          : null,
        joursManquants,
        historique: cloturesRecentes.map((c) => ({
          id: c.id,
          date: c.date.toISOString(),
          caissierNom: c.caissierNom,
          totalVentes: c.totalVentes,
          montantTotal: c.montantTotal.toString(),
          panierMoyen: c.panierMoyen.toString(),
          nbClients: c.nbClients,
          notes: c.notes,
        })),
      },
      finances: {
        creditsAlim: {
          actifs: credActifs?._count?.id ?? 0,
          epuises: credEpuisesCount,
          expires: credExpires?._count?.id ?? 0,
          montantTotal: montantTotalCred,
          montantUtilise: montantUtiliseCred,
          montantRestant: montantRestantCred,
        },
        cotisations: {
          payees: cotPayees?._count?.id ?? 0,
          enAttente: cotEnAttente?._count?.id ?? 0,
          expirees: cotExpCount,
          montantTotal: montantTotalCot,
        },
        tontines: {
          actives: tontinesActives,
          terminees: tontinesTerminees,
          total: tontinesGrouped.reduce((s, g) => s + g._count.id, 0),
        },
      },
      gestionnaireActivite,
    });
  } catch (error) {
    console.error("GET /api/auditeur/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
