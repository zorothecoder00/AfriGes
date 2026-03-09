import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/dashboard
 * Toutes les données sont filtrées sur le PDV du RPV connecté.
 */
export async function GET() {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // ── PDV du RPV ───────────────────────────────────────────────────────────
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ message: "Aucun PDV associé" }, { status: 400 });

    const now          = new Date();
    const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay     = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const il7j         = new Date(now); il7j.setDate(now.getDate() - 7);
    const il30j        = new Date(now); il30j.setDate(now.getDate() - 30);

    // Filtre commun VersementPack → clients du PDV
    const versementWhere = { souscription: { client: { pointDeVenteId: pdv.id } }, statut: "PAYE" } as const;

    const [
      ventesDirectesJour,
      ventesDirectesSemaine,
      ventesDirectesMois,
      versementsJour,
      versementsSemaine,
      versementsMois,
      versementsJourRecents,
      stocksSite,
      receptionsActives,
      derniereCloture,
      mouvementsRecents,
      sessionsCaisses,
      activitesRecentes,
      topProduitsRaw,
      equipeAffectees,
    ] = await Promise.all([

      // Ventes directes confirmées du jour — PDV du RPV
      prisma.venteDirecte.findMany({
        where: {
          pointDeVenteId: pdv.id,
          statut:         "CONFIRMEE",
          createdAt:      { gte: startOfDay, lte: endOfDay },
        },
        select: {
          id: true, montantTotal: true, modePaiement: true, createdAt: true,
          vendeur: { select: { nom: true, prenom: true } },
          client:  { select: { nom: true, prenom: true } },
          lignes:  { select: { produit: { select: { nom: true } } }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // CA semaine — VenteDirecte PDV
      prisma.venteDirecte.aggregate({
        where: { pointDeVenteId: pdv.id, statut: "CONFIRMEE", createdAt: { gte: startOfWeek } },
        _sum:   { montantTotal: true },
        _count: { id: true },
      }),

      // CA mois — VenteDirecte PDV
      prisma.venteDirecte.aggregate({
        where: { pointDeVenteId: pdv.id, statut: "CONFIRMEE", createdAt: { gte: startOfMonth } },
        _sum:   { montantTotal: true },
        _count: { id: true },
      }),

      // CA jour — VersementPack clients du PDV
      prisma.versementPack.aggregate({
        where: { ...versementWhere, datePaiement: { gte: startOfDay, lte: endOfDay } },
        _sum:   { montant: true },
        _count: { id: true },
      }),

      // CA semaine — VersementPack
      prisma.versementPack.aggregate({
        where: { ...versementWhere, datePaiement: { gte: startOfWeek } },
        _sum:   { montant: true },
        _count: { id: true },
      }),

      // CA mois — VersementPack
      prisma.versementPack.aggregate({
        where: { ...versementWhere, datePaiement: { gte: startOfMonth } },
        _sum:   { montant: true },
        _count: { id: true },
      }),

      // Versements récents du jour (pour les "dernières ventes")
      prisma.versementPack.findMany({
        where: { ...versementWhere, datePaiement: { gte: startOfDay, lte: endOfDay } },
        select: {
          id: true, montant: true, datePaiement: true,
          souscription: {
            select: {
              pack:   { select: { nom: true } },
              client: { select: { nom: true, prenom: true } },
            },
          },
        },
        orderBy: { datePaiement: "desc" },
        take: 10,
      }),

      // Stock de ce PDV uniquement
      prisma.stockSite.findMany({
        where: { pointDeVenteId: pdv.id },
        include: {
          produit: { select: { id: true, nom: true, alerteStock: true, prixUnitaire: true } },
        },
      }),

      // Réceptions d'approvisionnement actives — PDV
      prisma.receptionApprovisionnement.findMany({
        where:   { pointDeVenteId: pdv.id, statut: { in: ["BROUILLON", "EN_COURS"] } },
        select:  {
          id: true, reference: true, type: true, statut: true,
          fournisseurNom: true, origineNom: true,
          datePrevisionnelle: true,
          lignes: { select: { id: true } },
        },
        orderBy: { datePrevisionnelle: "asc" },
        take: 5,
      }),

      // Dernière clôture caisse — PDV
      prisma.clotureCaisse.findFirst({
        where:   { pointDeVenteId: pdv.id },
        orderBy: { date: "desc" },
      }),

      // Mouvements de stock récents — PDV
      prisma.mouvementStock.findMany({
        where:   { pointDeVenteId: pdv.id, dateMouvement: { gte: il7j } },
        select:  { id: true, type: true, quantite: true, motif: true, dateMouvement: true, produit: { select: { nom: true } } },
        orderBy: { dateMouvement: "desc" },
        take: 6,
      }),

      // Sessions caisses ouvertes — PDV
      prisma.sessionCaisse.findMany({
        where:   { pointDeVenteId: pdv.id, statut: { in: ["OUVERTE", "SUSPENDUE"] } },
        select:  { id: true, caissierNom: true, statut: true, dateOuverture: true, fondsCaisse: true },
        orderBy: { dateOuverture: "desc" },
      }),

      // Activités récentes — filtrées aux membres affectés au PDV
      // On prend les userId des affectations actives du PDV
      prisma.gestionnaireAffectation.findMany({
        where:  { pointDeVenteId: pdv.id, actif: true },
        select: { userId: true },
      }).then(affs => {
        const ids = [userId, ...affs.map(a => a.userId)];
        return prisma.auditLog.findMany({
          where:   { userId: { in: ids } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true, action: true, entite: true, entiteId: true, createdAt: true,
            user: { select: { nom: true, prenom: true } },
          },
        });
      }),

      // Top produits — VenteDirecte confirmées 30j + ReceptionProduitPack livrées 30j
      Promise.all([
        prisma.venteDirecte.findMany({
          where: { pointDeVenteId: pdv.id, statut: "CONFIRMEE", createdAt: { gte: il30j } },
          select: { lignes: { select: { produitId: true, quantite: true, produit: { select: { nom: true } } } } },
        }),
        prisma.receptionProduitPack.findMany({
          where: { statut: "LIVREE", dateLivraison: { gte: il30j }, souscription: { client: { pointDeVenteId: pdv.id } } },
          select: { lignes: { select: { produitId: true, quantite: true, produit: { select: { nom: true } } } } },
        }),
      ]),

      // Équipe affectée au PDV
      prisma.gestionnaireAffectation.findMany({
        where: { pointDeVenteId: pdv.id, actif: true },
        include: {
          user: { select: { gestionnaire: { select: { role: true } } } },
        },
      }),
    ]);

    // ── Stats ventes du jour (VenteDirecte + VersementPack) ─────────────────
    const caJourVentes     = ventesDirectesJour.reduce((s, v) => s + Number(v.montantTotal), 0);
    const caJourVersements = Number(versementsJour._sum.montant ?? 0);
    const caJour           = caJourVentes + caJourVersements;
    const nbVentes         = ventesDirectesJour.length + versementsJour._count.id;
    const panierMoyen      = nbVentes > 0 ? caJour / nbVentes : 0;

    // ── Stats stock — uniquement ce PDV ────────────────────────────────────
    const enRupture   = stocksSite.filter(s => s.quantite === 0).length;
    const stockFaible = stocksSite.filter(s => s.quantite > 0 && s.quantite <= s.produit.alerteStock).length;
    const valeurStock = stocksSite.reduce((acc, s) => acc + Number(s.produit.prixUnitaire) * s.quantite, 0);
    const alertesProduits = stocksSite
      .filter(s => s.quantite <= s.produit.alerteStock)
      .sort((a, b) => a.quantite - b.quantite)
      .slice(0, 10)
      .map(s => ({ id: s.produit.id, nom: s.produit.nom, stock: s.quantite, alerteStock: s.produit.alerteStock }));

    // ── Évolution par heure — VenteDirecte + VersementPack ─────────────────
    const evolution = Array.from({ length: 24 }, (_, h) => {
      const hvd = ventesDirectesJour.filter(v => new Date(v.createdAt).getHours() === h);
      const hvp = versementsJourRecents.filter(v => new Date(v.datePaiement).getHours() === h);
      const montant = hvd.reduce((s, v) => s + Number(v.montantTotal), 0)
                    + hvp.reduce((s, v) => s + Number(v.montant), 0);
      return { heure: h, count: hvd.length + hvp.length, montant };
    });

    // ── Recentes : mix VenteDirecte + VersementPack du jour ────────────────
    const recentesVD = ventesDirectesJour.slice(0, 5).map(v => ({
      id:         v.id,
      produitNom: v.lignes[0]?.produit.nom ?? "—",
      quantite:   1,
      montant:    Number(v.montantTotal),
      clientNom:  v.client ? `${v.client.prenom} ${v.client.nom}` : "—",
      heure:      new Date(v.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      type:       "VENTE",
    }));
    const recentesVP = versementsJourRecents.slice(0, 5).map(v => ({
      id:         v.id,
      produitNom: v.souscription.pack.nom,
      quantite:   1,
      montant:    Number(v.montant),
      clientNom:  v.souscription.client ? `${v.souscription.client.prenom} ${v.souscription.client.nom}` : "—",
      heure:      new Date(v.datePaiement).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      type:       "VERSEMENT",
    }));
    const recentes = [...recentesVD, ...recentesVP]
      .sort((a, b) => b.heure.localeCompare(a.heure))
      .slice(0, 5);

    // ── Top produits 30j (VenteDirecte + ReceptionProduitPack fusionnés) ────
    const [ventesRaw, recPacksRaw] = topProduitsRaw;
    const prodMap = new Map<number, { nom: string; quantite: number; nbVentes: number }>();
    const addLignes = (lignes: { produitId: number; quantite: number; produit: { nom: string } }[]) => {
      for (const l of lignes) {
        const existing = prodMap.get(l.produitId);
        if (existing) { existing.quantite += l.quantite; existing.nbVentes += 1; }
        else           prodMap.set(l.produitId, { nom: l.produit.nom, quantite: l.quantite, nbVentes: 1 });
      }
    };
    for (const v of ventesRaw)   addLignes(v.lignes);
    for (const r of recPacksRaw) addLignes(r.lignes);
    const topProduitsLivres = Array.from(prodMap.entries())
      .sort((a, b) => b[1].quantite - a[1].quantite)
      .slice(0, 5)
      .map(([produitId, d]) => ({ produitId, nom: d.nom, quantite: d.quantite, nbLivraisons: d.nbVentes }));

    // ── Équipe stats par rôle ───────────────────────────────────────────────
    const equipePDV: Record<string, number> = {};
    for (const a of equipeAffectees) {
      const role = a.user.gestionnaire?.role;
      if (role) equipePDV[role] = (equipePDV[role] ?? 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        today: { date: now.toISOString() },
        ventes: {
          total: nbVentes, montant: caJour, panierMoyen,
          semaine: {
            total:   ventesDirectesSemaine._count.id + versementsSemaine._count.id,
            montant: Number(ventesDirectesSemaine._sum.montantTotal ?? 0) + Number(versementsSemaine._sum.montant ?? 0),
          },
          mois: {
            total:   ventesDirectesMois._count.id + versementsMois._count.id,
            montant: Number(ventesDirectesMois._sum.montantTotal ?? 0) + Number(versementsMois._sum.montant ?? 0),
          },
          recentes,
          evolution,
        },
        stock: {
          total:            stocksSite.length,
          enRupture,
          stockFaible,
          valeurStock,
          alertesProduits,
        },
        livraisons: {
          brouillon:  receptionsActives.filter(l => l.statut === "BROUILLON").length,
          enCours:    receptionsActives.filter(l => l.statut === "EN_COURS").length,
          prochaines: receptionsActives.map(l => ({
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
        mouvementsRecents: mouvementsRecents.map(m => ({
          ...m, dateMouvement: m.dateMouvement.toISOString(), produitNom: m.produit.nom,
        })),
        equipe: equipePDV,
        sessionsCaisses: sessionsCaisses.map(s => ({
          id: s.id, caissierNom: s.caissierNom, statut: s.statut,
          dateOuverture: s.dateOuverture.toISOString(),
          fondsCaisse:   Number(s.fondsCaisse),
        })),
        topProduitsLivres,
        activitesRecentes: activitesRecentes.map(a => ({
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
