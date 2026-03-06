import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

export async function GET() {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const now          = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalAuditLogs,
      actionsToday,
      suppressionsAujourdhui,
      produits,
      versementsRecents,
      souscriptionsGrouped,
      echeancesEnRetard,
      livraisonsGrouped,
      livraisonsEnRetardCount,
      livraisonsRecentes,
      cloturesRecentes,
      packsCount,
      gestionnaireActifsCount,
      auditCountByUser,
      auditLastByUser,
      receptionsPackRecentes,
      receptionsPackGrouped,
    ] = await Promise.all([

      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: startOfToday } } }),

      // Suppressions/annulations aujourd'hui — indicateur de fraude potentielle
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startOfToday },
          OR: [
            { action: { contains: "supprim", mode: "insensitive" } },
            { action: { contains: "DELETE",  mode: "insensitive" } },
            { action: { contains: "annul",   mode: "insensitive" } },
          ],
        },
      }),

      // Tous les produits pour audit stock (avec stock par site)
      prisma.produit.findMany({
        orderBy: { nom: "asc" },
        select: { id: true, nom: true, alerteStock: true, prixUnitaire: true, actif: true, stocks: { select: { quantite: true } } },
      }),

      // Versements packs des 30 derniers jours
      prisma.versementPack.findMany({
        where: { datePaiement: { gte: thirtyDaysAgo } },
        include: {
          souscription: {
            include: {
              pack:   { select: { id: true, nom: true, type: true } },
              client: { select: { id: true, nom: true, prenom: true } },
              user:   { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),

      // Stats souscriptions par statut
      prisma.souscriptionPack.groupBy({
        by: ["statut"],
        _count: { id: true },
        _sum:   { montantVerse: true, montantRestant: true },
      }),

      // Échéances en retard
      prisma.echeancePack.count({ where: { statut: "EN_RETARD" } }),

      prisma.receptionApprovisionnement.groupBy({ by: ["statut"], _count: { id: true } }),

      // Réceptions ayant dépassé leur date prévisionnelle sans être reçues
      prisma.receptionApprovisionnement.count({
        where: {
          datePrevisionnelle: { lt: now },
          statut: { in: ["BROUILLON", "EN_COURS"] },
        },
      }),

      prisma.receptionApprovisionnement.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        include: { lignes: { include: { produit: { select: { id: true, nom: true } } } } },
      }),

      // Clôtures de caisse des 7 derniers jours
      prisma.clotureCaisse.findMany({
        where: { date: { gte: sevenDaysAgo } },
        orderBy: { date: "desc" },
        take: 10,
      }),

      prisma.pack.count(),

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

      // Réceptions de produits liées aux packs (30 derniers jours)
      prisma.receptionProduitPack.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: {
          souscription: {
            include: {
              pack:   { select: { id: true, nom: true, type: true } },
              client: { select: { id: true, nom: true, prenom: true } },
              user:   { select: { id: true, nom: true, prenom: true } },
            },
          },
          lignes: { include: { produit: { select: { nom: true } } } },
        },
      }),

      // Stats des réceptions pack par statut
      prisma.receptionProduitPack.groupBy({
        by: ["statut"],
        _count: { id: true },
      }),
    ]);

    // ── Stock ─────────────────────────────────────────────────────────────────

    const produitsAvecStock = produits.map((p) => ({
      ...p,
      totalStock: p.stocks.reduce((s, ss) => s + ss.quantite, 0),
    }));
    const enRupture    = produitsAvecStock.filter((p) => p.totalStock === 0).length;
    const stockFaible  = produitsAvecStock.filter((p) => p.totalStock > 0 && p.alerteStock > 0 && p.totalStock <= p.alerteStock).length;
    const valeurTotale = produitsAvecStock.reduce((sum, p) => sum + Number(p.prixUnitaire) * p.totalStock, 0);

    // ── Versements ────────────────────────────────────────────────────────────

    const montantTotal30j = versementsRecents.reduce((sum, v) => sum + Number(v.montant), 0);

    // ── Souscriptions ─────────────────────────────────────────────────────────

    const souscActives   = souscriptionsGrouped.find((g) => g.statut === "ACTIF");
    const souscCompletes = souscriptionsGrouped.find((g) => g.statut === "COMPLETE");
    const souscAnnulees  = souscriptionsGrouped.find((g) => g.statut === "ANNULE");
    const montantTotalVerse   = souscriptionsGrouped.reduce((s, g) => s + Number(g._sum?.montantVerse  ?? 0), 0);
    const montantTotalRestant = souscriptionsGrouped.reduce((s, g) => s + Number(g._sum?.montantRestant ?? 0), 0);

    // ── Livraisons stats ──────────────────────────────────────────────────────

    const livraisonsStats: Record<string, number> = {};
    livraisonsGrouped.forEach((g) => { livraisonsStats[g.statut] = g._count.id; });

    // ── Réceptions pack stats ─────────────────────────────────────────────────

    const receptionsPackStats: Record<string, number> = {};
    receptionsPackGrouped.forEach((g) => { receptionsPackStats[g.statut] = g._count.id; });

    // ── Clôtures manquantes ───────────────────────────────────────────────────

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

    // ── Anomalies ─────────────────────────────────────────────────────────────

    type NiveauAnomalie = "CRITIQUE" | "HAUTE" | "MOYENNE" | "BASSE";
    const anomalies: Array<{ type: string; niveau: NiveauAnomalie; description: string; entite: string; entiteId?: number }> = [];

    produitsAvecStock.filter((p) => p.totalStock === 0).forEach((p) =>
      anomalies.push({ type: "STOCK_RUPTURE", niveau: "CRITIQUE", description: `${p.nom} — rupture totale de stock`, entite: "Produit", entiteId: p.id })
    );

    produitsAvecStock.filter((p) => p.totalStock > 0 && p.alerteStock > 0 && p.totalStock <= p.alerteStock).forEach((p) =>
      anomalies.push({ type: "STOCK_FAIBLE", niveau: "HAUTE", description: `${p.nom} — stock critique (${p.totalStock} unités, seuil: ${p.alerteStock})`, entite: "Produit", entiteId: p.id })
    );

    if (livraisonsEnRetardCount > 0) {
      anomalies.push({ type: "LIVRAISON_RETARD", niveau: livraisonsEnRetardCount >= 3 ? "CRITIQUE" : "HAUTE", description: `${livraisonsEnRetardCount} livraison(s) dépassent leur date prévisionnelle`, entite: "Livraison" });
    }

    if (joursManquants.length > 0) {
      anomalies.push({ type: "CLOTURE_MANQUANTE", niveau: joursManquants.length >= 3 ? "CRITIQUE" : "HAUTE", description: `${joursManquants.length} jour(s) sans clôture de caisse (7 derniers jours)`, entite: "ClotureCaisse" });
    }

    if (suppressionsAujourdhui >= 3) {
      anomalies.push({ type: "SUPPRESSIONS_MASSIVES", niveau: suppressionsAujourdhui >= 6 ? "CRITIQUE" : "HAUTE", description: `${suppressionsAujourdhui} opération(s) de suppression/annulation aujourd'hui`, entite: "AuditLog" });
    }

    if (echeancesEnRetard >= 1) {
      anomalies.push({ type: "ECHEANCES_RETARD", niveau: echeancesEnRetard > 20 ? "HAUTE" : echeancesEnRetard > 5 ? "MOYENNE" : "BASSE", description: `${echeancesEnRetard} échéance(s) de packs en retard de paiement`, entite: "EcheancePack" });
    }

    const niveauOrder: Record<NiveauAnomalie, number> = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3 };
    anomalies.sort((a, b) => (niveauOrder[a.niveau as NiveauAnomalie] ?? 4) - (niveauOrder[b.niveau as NiveauAnomalie] ?? 4));

    // ── Score de conformité ───────────────────────────────────────────────────

    const nCritique = anomalies.filter((a) => a.niveau === "CRITIQUE").length;
    const nHaute    = anomalies.filter((a) => a.niveau === "HAUTE").length;
    const nMoyenne  = anomalies.filter((a) => a.niveau === "MOYENNE").length;
    const nBasse    = anomalies.filter((a) => a.niveau === "BASSE").length;
    const scoreConformite = Math.max(0, Math.min(100, 100 - nCritique * 15 - nHaute * 8 - nMoyenne * 3 - nBasse * 1));

    // ── Activité gestionnaires ────────────────────────────────────────────────

    const countMap: Record<number, number> = {};
    auditCountByUser.forEach((g) => { if (g.userId) countMap[g.userId] = g._count.id; });
    const lastMap: Record<number, string> = {};
    auditLastByUser.forEach((g) => { if (g.userId && g._max.createdAt) lastMap[g.userId] = (g._max.createdAt as Date).toISOString(); });

    const topUserIds = auditCountByUser.map((g) => g.userId).filter(Boolean) as number[];
    const topGestionnaires = topUserIds.length > 0
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
        totalProduits: produitsAvecStock.length,
        enRupture,
        stockFaible,
        valeurTotale,
        produits: produitsAvecStock.map((p) => ({
          id: p.id,
          nom: p.nom,
          prixUnitaire: p.prixUnitaire.toString(),
          stock: p.totalStock,
          alerteStock: p.alerteStock,
        })),
      },
      ventes: {
        totalCe30Jours:    versementsRecents.length,
        montantTotal30Jours: montantTotal30j,
        recentes: versementsRecents.slice(0, 25).map((v) => {
          const person = v.souscription.client ?? v.souscription.user;
          return {
            id:           v.id,
            packNom:      v.souscription.pack.nom,
            packType:     v.souscription.pack.type,
            montant:      Number(v.montant).toString(),
            type:         v.type,
            datePaiement: v.datePaiement.toISOString(),
            beneficiaire: person ? `${person.prenom} ${person.nom}` : "—",
          };
        }),
      },
      livraisons: {
        stats: livraisonsStats,
        enRetard: livraisonsEnRetardCount,
        recentes: livraisonsRecentes.map((r) => ({
          id: r.id,
          reference: r.reference,
          type: r.type,
          statut: r.statut,
          fournisseurNom: r.fournisseurNom,
          origineNom: r.origineNom,
          datePrevisionnelle: r.datePrevisionnelle.toISOString(),
          dateReception: r.dateReception?.toISOString() ?? null,
          isEnRetard: r.datePrevisionnelle < now && ["BROUILLON", "EN_COURS"].includes(r.statut),
          nbLignes: r.lignes.length,
        })),
      },
      receptionsPack: {
        stats: receptionsPackStats,
        recentes: receptionsPackRecentes.map((r) => {
          const person = r.souscription.client ?? r.souscription.user;
          return {
            id: r.id,
            statut: r.statut,
            packNom: r.souscription.pack.nom,
            packType: r.souscription.pack.type,
            souscriptionId: r.souscriptionId,
            beneficiaire: person ? `${person.prenom} ${person.nom}` : "—",
            livreurNom: r.livreurNom,
            datePrevisionnelle: r.datePrevisionnelle.toISOString(),
            dateLivraison: r.dateLivraison?.toISOString() ?? null,
            notes: r.notes,
            produits: r.lignes.map((l) => `${l.produit.nom} ×${l.quantite}`).join(", "),
          };
        }),
      },
      clotureCaisse: {
        derniere: cloturesRecentes[0]
          ? {
              id:           cloturesRecentes[0].id,
              date:         cloturesRecentes[0].date.toISOString(),
              caissierNom:  cloturesRecentes[0].caissierNom,
              totalVentes:  cloturesRecentes[0].totalVentes,
              montantTotal: cloturesRecentes[0].montantTotal.toString(),
              panierMoyen:  cloturesRecentes[0].panierMoyen.toString(),
              nbClients:    cloturesRecentes[0].nbClients,
              notes:        cloturesRecentes[0].notes,
            }
          : null,
        joursManquants,
        historique: cloturesRecentes.map((c) => ({
          id:           c.id,
          date:         c.date.toISOString(),
          caissierNom:  c.caissierNom,
          totalVentes:  c.totalVentes,
          montantTotal: c.montantTotal.toString(),
          panierMoyen:  c.panierMoyen.toString(),
          nbClients:    c.nbClients,
          notes:        c.notes,
        })),
      },
      finances: {
        souscriptions: {
          actives:          souscActives?._count?.id  ?? 0,
          completes:        souscCompletes?._count?.id ?? 0,
          annulees:         souscAnnulees?._count?.id  ?? 0,
          montantTotalVerse,
          montantRestant:   montantTotalRestant,
        },
        packs: { actifs: packsCount, total: packsCount },
        echeancesEnRetard,
      },
      gestionnaireActivite,
    });
  } catch (error) {
    console.error("GET /api/auditeur/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
