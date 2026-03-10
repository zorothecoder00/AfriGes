import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";

/**
 * GET /api/caissier/dashboard
 *
 * Tableau de bord temps réel du caissier — strictement scoped au PDV du caissier.
 */
export async function GET() {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Filtres scoped
    const souscriptionFilter = pdvId ? souscriptionPdvWhere(pdvId) : {};

    // Marquer les échéances dépassées → EN_RETARD (scoped au PDV)
    // Wrapped in try-catch pour éviter de planter tout le dashboard si le filtre de relation échoue
    try {
      await prisma.echeancePack.updateMany({
        where: {
          statut: "EN_ATTENTE",
          datePrevue: { lt: now },
          ...(pdvId ? { souscription: souscriptionFilter } : {}),
        },
        data: { statut: "EN_RETARD" },
      });
    } catch (e) {
      console.warn("echeancePack.updateMany (mark EN_RETARD) non-fatal:", e);
    }

    // ── Session active du caissier connecté ────────────────────────────────
    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: {
        statut: { in: ["OUVERTE", "SUSPENDUE"] },
        ...(isAdmin ? {} : { caissierId: userId }),
      },
      orderBy: { createdAt: "desc" },
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

      // Versements encaissés aujourd'hui — scoped au PDV
      prisma.versementPack.findMany({
        where: {
          datePaiement: { gte: startOfDay, lte: endOfDay },
          ...(pdvId ? { souscription: souscriptionFilter } : {}),
        },
        select: {
          id: true,
          montant: true,
          type: true,
          datePaiement: true,
          encaisseParNom: true,
          souscription: {
            select: {
              pack:   { select: { nom: true, type: true } },
              client: { select: { nom: true, prenom: true } },
              user:   { select: { nom: true, prenom: true } },
            },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),

      // Stock du PDV uniquement
      prisma.produit.findMany({
        select: {
          id: true,
          nom: true,
          alerteStock: true,
          prixUnitaire: true,
          stocks: {
            where: pdvId ? { pointDeVenteId: pdvId } : {},
            select: { quantite: true },
          },
        },
      }),

      // Souscriptions actives — scoped au PDV
      prisma.souscriptionPack.count({
        where: { statut: "ACTIF", ...souscriptionFilter },
      }),

      // Souscriptions en attente — scoped au PDV
      prisma.souscriptionPack.count({
        where: { statut: "EN_ATTENTE", ...souscriptionFilter },
      }),

      // Échéances en retard — scoped au PDV
      prisma.echeancePack.findMany({
        where: {
          statut: "EN_RETARD",
          ...(pdvId ? { souscription: souscriptionFilter } : {}),
        },
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

      // Dernière clôture du PDV/caissier
      prisma.clotureCaisse.findFirst({
        where: isAdmin
          ? {}
          : pdvId
            ? { pointDeVenteId: pdvId }
            : { session: { caissierId: userId } },
        orderBy: { date: "desc" },
      }),
    ]);

    // ── Stats versements du jour ───────────────────────────────────────────
    const totalVersements = versementsAujourdhui.length;
    const montantJour     = versementsAujourdhui.reduce((s, v) => s + Number(v.montant), 0);

    const clientsVus = new Set(
      versementsAujourdhui.map((v) => {
        const c = v.souscription.client ?? v.souscription.user;
        return c ? `${c.nom}-${c.prenom}` : null;
      }).filter(Boolean)
    );
    const nbClients = clientsVus.size;

    // ── Stats stock (PDV scoped) ────────────────────────────────────────────
    const produitsAvecStock = produits.map((p) => ({
      ...p,
      totalStock: p.stocks.reduce((s, ss) => s + ss.quantite, 0),
    }));
    const stockFaible = produitsAvecStock.filter((p) => p.totalStock > 0 && p.totalStock <= p.alerteStock).length;
    const enRupture   = produitsAvecStock.filter((p) => p.totalStock === 0).length;
    const valeurStock = produitsAvecStock.reduce((s, p) => s + Number(p.prixUnitaire) * p.totalStock, 0);

    // ── Alertes ────────────────────────────────────────────────────────────
    const alertes: { type: "danger" | "warning" | "info"; message: string }[] = [];
    if (!sessionActive)
      alertes.push({ type: "warning", message: "Aucune session de caisse ouverte — veuillez ouvrir la caisse" });
    if (sessionActive?.statut === "SUSPENDUE")
      alertes.push({ type: "warning", message: "Session de caisse suspendue — reprenez la session pour continuer" });
    if (derniereCloture && derniereCloture.ecart !== null && Number(derniereCloture.ecart) !== 0)
      alertes.push({ type: "danger",  message: `Écart de caisse détecté lors de la dernière clôture : ${Number(derniereCloture.ecart).toLocaleString("fr-FR")} FCFA` });
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

    // ── Solde temps réel — scoped au caissier ─────────────────────────────
    const fondsCaisse = sessionActive ? Number(sessionActive.fondsCaisse) : 0;

    // Filtrer par sessionId directement (plus simple que passer par la relation session)
    const sessionIdFilter = sessionActive
      ? { sessionId: sessionActive.id }
      : isAdmin
        ? {}
        : { sessionId: -1 }; // caissier sans session → aucune opération

    const [encaissAgg, decaissAgg, transfertAgg] = await Promise.all([
      prisma.operationCaisse.aggregate({
        _sum: { montant: true },
        where: { ...sessionIdFilter, type: "ENCAISSEMENT", createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.operationCaisse.aggregate({
        _sum: { montant: true },
        where: { ...sessionIdFilter, type: "DECAISSEMENT", createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.transfertCaisse.aggregate({
        _sum: { montant: true },
        where: { ...sessionIdFilter, createdAt: { gte: startOfDay, lte: endOfDay } },
      }),
    ]);

    const encaissJour   = Number(encaissAgg._sum.montant ?? 0);
    const decaissJour   = Number(decaissAgg._sum.montant ?? 0);
    const transfertJour = Number(transfertAgg._sum.montant ?? 0);
    const soldeTempsReel = fondsCaisse + montantJour + encaissJour - decaissJour - transfertJour;

    return NextResponse.json({
      success: true,
      data: {
        today: {
          date:       now.toISOString(),
          startOfDay: startOfDay.toISOString(),
        },
        sessionActive: sessionActive
          ? {
              id:            sessionActive.id,
              statut:        sessionActive.statut,
              fondsCaisse,
              dateOuverture: sessionActive.dateOuverture.toISOString(),
              caissierNom:   sessionActive.caissierNom,
            }
          : null,
        soldeTempsReel,
        operationsJour: {
          encaissements: encaissJour,
          decaissements: decaissJour,
          transferts:    transfertJour,
        },
        versements: {
          total:    totalVersements,
          montant:  montantJour,
          nbClients,
        },
        stock: {
          total:   produitsAvecStock.length,
          faible:  stockFaible,
          rupture: enRupture,
          valeur:  valeurStock,
          produitsAlerte: produitsAvecStock
            .filter((p) => p.totalStock <= p.alerteStock)
            .map((p) => ({ id: p.id, nom: p.nom, stock: p.totalStock, alerteStock: p.alerteStock })),
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
