import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/dashboard
 *
 * Tableau de bord agrégé du Responsable PDV :
 *  - Ventes du jour (supervision caisse)
 *  - État complet du stock + alertes
 *  - Livraisons en cours / à venir
 *  - Dernières clôtures de caisse
 *  - Mouvements de stock récents
 *  - KPIs équipe (nbre par rôle)
 */
export async function GET() {
  try {
    const session = await getRPVSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const il7j       = new Date(now); il7j.setDate(now.getDate() - 7);

    const [
      ventesJour,
      produits,
      livraisonsActives,
      derniereCloture,
      mouvementsRecents,
      equipeStats,
    ] = await Promise.all([

      // Ventes du jour
      prisma.venteCreditAlimentaire.findMany({
        where:  { createdAt: { gte: startOfDay, lte: endOfDay } },
        select: { id: true, quantite: true, prixUnitaire: true, createdAt: true,
                  produit: { select: { nom: true } },
                  creditAlimentaire: {
                    select: {
                      member: { select: { nom: true, prenom: true } },
                      client: { select: { nom: true, prenom: true } },
                    },
                  } },
        orderBy: { createdAt: "desc" },
        take:    10,
      }),

      // Tous les produits pour stats
      prisma.produit.findMany({
        select: { id: true, nom: true, stock: true, alerteStock: true, prixUnitaire: true },
      }),

      // Livraisons actives (EN_ATTENTE ou EN_COURS)
      prisma.livraison.findMany({
        where:   { statut: { in: ["EN_ATTENTE", "EN_COURS"] } },
        select:  { id: true, reference: true, type: true, statut: true,
                   fournisseurNom: true, destinataireNom: true,
                   datePrevisionnelle: true, planifiePar: true,
                   lignes: { select: { id: true } } },
        orderBy: { datePrevisionnelle: "asc" },
        take:    5,
      }),

      // Dernière clôture caisse
      prisma.clotureCaisse.findFirst({ orderBy: { date: "desc" } }),

      // Derniers mouvements de stock (7j)
      prisma.mouvementStock.findMany({
        where:   { dateMouvement: { gte: il7j } },
        select:  { id: true, type: true, quantite: true, motif: true,
                   dateMouvement: true,
                   produit: { select: { nom: true } } },
        orderBy: { dateMouvement: "desc" },
        take:    6,
      }),

      // Stats équipe par rôle
      prisma.gestionnaire.groupBy({
        by:     ["role"],
        _count: { id: true },
        where:  { actif: true },
      }),
    ]);

    // ── Stats ventes du jour ───────────────────────────────────────────────
    const caJour     = ventesJour.reduce((s, v) => s + Number(v.prixUnitaire) * v.quantite, 0);
    const nbVentes   = ventesJour.length;
    const panierMoyen = nbVentes > 0 ? caJour / nbVentes : 0;

    // ── Stats stock ────────────────────────────────────────────────────────
    const enRupture  = produits.filter((p) => p.stock === 0).length;
    const stockFaible= produits.filter((p) => p.stock > 0 && p.stock <= p.alerteStock).length;
    const valeurStock= produits.reduce((s, p) => s + Number(p.prixUnitaire) * p.stock, 0);
    const alertesProduits = produits
      .filter((p) => p.stock <= p.alerteStock)
      .sort((a, b) => a.stock - b.stock)
      .map((p) => ({ id: p.id, nom: p.nom, stock: p.stock, alerteStock: p.alerteStock }));

    // ── Evolution ventes par heure ─────────────────────────────────────────
    const ventesParHeure = Array.from({ length: 24 }, (_, h) => {
      const hvs = ventesJour.filter((v) => new Date(v.createdAt).getHours() === h);
      return { heure: h, count: hvs.length, montant: hvs.reduce((s, v) => s + Number(v.prixUnitaire) * v.quantite, 0) };
    });

    // ── Équipe stats ───────────────────────────────────────────────────────
    const equipePDV: Record<string, number> = {};
    for (const g of equipeStats) equipePDV[g.role] = g._count.id;

    return NextResponse.json({
      success: true,
      data: {
        today: { date: now.toISOString() },
        ventes: {
          total: nbVentes, montant: caJour, panierMoyen,
          recentes: ventesJour.slice(0, 5).map((v) => {
            const person = v.creditAlimentaire?.client ?? v.creditAlimentaire?.member;
            return { id: v.id, produitNom: v.produit.nom, quantite: v.quantite,
                     montant: Number(v.prixUnitaire) * v.quantite,
                     clientNom: person ? `${person.prenom} ${person.nom}` : "—",
                     heure: new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) };
          }),
          evolution: ventesParHeure,
        },
        stock: {
          total: produits.length, enRupture, stockFaible, valeurStock, alertesProduits,
        },
        livraisons: {
          enAttente: livraisonsActives.filter((l) => l.statut === "EN_ATTENTE").length,
          enCours:   livraisonsActives.filter((l) => l.statut === "EN_COURS").length,
          prochaines: livraisonsActives.map((l) => ({
            id: l.id, reference: l.reference, type: l.type, statut: l.statut,
            partieNom: l.fournisseurNom ?? l.destinataireNom ?? "—",
            datePrevisionnelle: l.datePrevisionnelle.toISOString(),
            nbLignes: l.lignes.length,
          })),
        },
        derniereCloture: derniereCloture ? {
          ...derniereCloture,
          date: derniereCloture.date.toISOString(),
          montantTotal: Number(derniereCloture.montantTotal),
          panierMoyen:  Number(derniereCloture.panierMoyen),
        } : null,
        mouvementsRecents: mouvementsRecents.map((m) => ({
          ...m,
          dateMouvement: m.dateMouvement.toISOString(),
          produitNom: m.produit.nom,
        })),
        equipe: equipePDV,
      },
    });
  } catch (error) {
    console.error("RPV DASHBOARD ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
