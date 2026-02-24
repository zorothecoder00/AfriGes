import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";

/**
 * GET /api/caissier/dashboard
 *
 * Tableau de bord temps réel du caissier :
 *  - Stats du jour (versements collectés, montant, nb clients)
 *  - Souscriptions actives & en attente
 *  - Échéances en retard
 *  - État du stock
 *  - Dernière clôture connue
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

    // Marquer les échéances dépassées → EN_RETARD
    await prisma.echeancePack.updateMany({
      where: { statut: "EN_ATTENTE", datePrevue: { lt: now } },
      data: { statut: "EN_RETARD" },
    });

    // ── Requêtes parallèles ────────────────────────────────────────────────
    const [
      versementsAujourdhui,
      produits,
      souscriptionsActives,
      souscriptionsEnAttente,
      echeancesEnRetard,
      derniereCloture,
    ] = await Promise.all([

      // Versements encaissés aujourd'hui
      prisma.versementPack.findMany({
        where: { datePaiement: { gte: startOfDay, lte: endOfDay } },
        select: {
          id: true,
          montant: true,
          type: true,
          datePaiement: true,
          encaisseParNom: true,
          souscription: {
            select: {
              pack: { select: { nom: true, type: true } },
              client: { select: { nom: true, prenom: true } },
              user:   { select: { nom: true, prenom: true } },
            },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),

      // Stock
      prisma.produit.findMany({
        select: { id: true, nom: true, stock: true, alerteStock: true, prixUnitaire: true },
      }),

      // Souscriptions actives
      prisma.souscriptionPack.count({ where: { statut: "ACTIF" } }),

      // Souscriptions en attente
      prisma.souscriptionPack.count({ where: { statut: "EN_ATTENTE" } }),

      // Échéances en retard (avec détail pour affichage)
      prisma.echeancePack.findMany({
        where: { statut: "EN_RETARD" },
        orderBy: { datePrevue: "asc" },
        take: 10,
        include: {
          souscription: {
            include: {
              pack:   { select: { nom: true, type: true } },
              client: { select: { nom: true, prenom: true, telephone: true } },
              user:   { select: { nom: true, prenom: true, telephone: true } },
            },
          },
        },
      }),

      prisma.clotureCaisse.findFirst({ orderBy: { date: "desc" } }),
    ]);

    // ── Stats versements du jour ───────────────────────────────────────────
    const totalVersements = versementsAujourdhui.length;
    const montantJour     = versementsAujourdhui.reduce((s, v) => s + Number(v.montant), 0);

    // Clients distincts ayant versé aujourd'hui
    const clientsVus = new Set(
      versementsAujourdhui.map((v) => {
        const c = v.souscription.client ?? v.souscription.user;
        return c ? `${c.nom}-${c.prenom}` : null;
      }).filter(Boolean)
    );
    const nbClients = clientsVus.size;

    // ── Stats stock ────────────────────────────────────────────────────────
    const stockFaible = produits.filter((p) => p.stock > 0 && p.stock <= p.alerteStock).length;
    const enRupture   = produits.filter((p) => p.stock === 0).length;
    const valeurStock = produits.reduce((s, p) => s + Number(p.prixUnitaire) * p.stock, 0);

    // ── Alertes ────────────────────────────────────────────────────────────
    const alertes: { type: "danger" | "warning" | "info"; message: string }[] = [];
    if (echeancesEnRetard.length > 0)
      alertes.push({ type: "danger",  message: `${echeancesEnRetard.length} échéance(s) en retard à régulariser` });
    if (enRupture > 0)
      alertes.push({ type: "danger",  message: `${enRupture} produit(s) en rupture de stock` });
    if (stockFaible > 0)
      alertes.push({ type: "warning", message: `${stockFaible} produit(s) avec stock faible` });
    if (souscriptionsEnAttente > 0)
      alertes.push({ type: "info",    message: `${souscriptionsEnAttente} souscription(s) en attente d'acompte` });

    // ── Derniers versements (5) ────────────────────────────────────────────
    const derniersVersements = versementsAujourdhui.slice(0, 5).map((v) => {
      const person = v.souscription.client ?? v.souscription.user;
      return {
        id:        v.id,
        packNom:   v.souscription.pack.nom,
        packType:  v.souscription.pack.type,
        montant:   Number(v.montant),
        clientNom: person ? `${person.prenom} ${person.nom}` : "—",
        type:      v.type,
        heure:     v.datePaiement
          ? new Date(v.datePaiement).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
          : "—",
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        today: {
          date:       now.toISOString(),
          startOfDay: startOfDay.toISOString(),
        },
        versements: {
          total:    totalVersements,
          montant:  montantJour,
          nbClients,
        },
        stock: {
          total:   produits.length,
          faible:  stockFaible,
          rupture: enRupture,
          valeur:  valeurStock,
          produitsAlerte: produits
            .filter((p) => p.stock <= p.alerteStock)
            .map((p) => ({ id: p.id, nom: p.nom, stock: p.stock, alerteStock: p.alerteStock })),
        },
        souscriptionsActives,
        souscriptionsEnAttente,
        echeancesEnRetard: echeancesEnRetard.map((e) => ({
          id:         e.id,
          numero:     e.numero,
          montant:    Number(e.montant),
          datePrevue: e.datePrevue.toISOString(),
          packNom:    e.souscription.pack.nom,
          packType:   e.souscription.pack.type,
          client:     e.souscription.client ?? e.souscription.user,
        })),
        derniereCloture: derniereCloture
          ? {
              ...derniereCloture,
              date:         derniereCloture.date.toISOString(),
              montantTotal: Number(derniereCloture.montantTotal),
              panierMoyen:  Number(derniereCloture.panierMoyen),
            }
          : null,
        alertes,
        derniersVersements,
      },
    });
  } catch (error) {
    console.error("CAISSIER DASHBOARD ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
