import { NextResponse } from "next/server";
import { StatutBonCommande } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "../fournisseurs/route";
import { calculerCouvertureStock, tendanceFournisseur } from "@/lib/previsionStock";

const STATUT_ENGAGE: StatutBonCommande[] = [
  "PENDING_APPROVAL", "APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_DELIVERED",
];
const STATUT_NON_ANNULE: StatutBonCommande[] = [...STATUT_ENGAGE, "COMPLETED"];
const TYPES_SORTIE_CLIENT = ["VENTE_DIRECTE", "LIVRAISON_PACK", "LIVRAISON_CLIENT"] as const;

function moisLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}
function moisKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * GET /api/logistique/dashboard
 * Tableau de bord supply chain consolidé (CDC §14). Agrège les briques déjà
 * livrées (Fournisseurs, RFQ, PO, MRP, Importations) — aucune nouvelle donnée
 * stockée, tout est recalculé à la volée.
 *
 * Écarts assumés vs CDC (pas de fausse donnée) :
 * - Réseau : carte interactive (leaflet, cf. page) alimentée par la géolocalisation
 *   de PointDeVente (§3/§4) ; regroupement "par région" basé sur la hiérarchie
 *   plateforme régionale existante (pas de champ région libre dédié).
 * - §16 BI/IA prédictive : pas de modèle ML — projection statistique explicable
 *   (couverture de stock via conso moyenne, tendance fournisseur par delta de
 *   fenêtres), cf. lib/previsionStock.ts.
 * - Rotation des stocks : ratio valeur des sorties (6 mois) / valeur du stock
 *   ACTUEL (pas de snapshot d'inventaire historique en base pour une moyenne
 *   période) — proxy explicite, pas une vraie moyenne d'inventaire.
 * - Économie réalisée : écart entre le prix retenu et la moyenne des autres
 *   cotations RFQ sur la même demande (uniquement si favorable) — mesure la
 *   valeur de la mise en concurrence, pas un budget/prévisionnel externe.
 * - Finances : "factures à payer" = solde `BonCommande.montantTotal −
 *   montantPaye` par fournisseur (POs non annulés, hors brouillon/attente
 *   approbation). "Prévisions de trésorerie" = position nette (entrées −
 *   sorties) par tranche d'ancienneté : sorties = échéancier ci-dessus (proxy
 *   sur dateLivraisonPrevue, faute de date d'échéance de paiement dédiée) ;
 *   entrées = échéances non soldées de `EcheanceCredit` (remboursements
 *   crédit client) + `EcheancePack` (collecte souscriptions), datées
 *   réellement, PLUS la moyenne mensuelle réelle des ventes directes (3 mois)
 *   comme flux récurrent — ces dernières sont encaissées comptant, donc non
 *   intégrées à l'échéancier daté, juste indiquées à part.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const depuis6Mois = new Date();
    depuis6Mois.setMonth(depuis6Mois.getMonth() - 5);
    depuis6Mois.setDate(1);
    depuis6Mois.setHours(0, 0, 0, 0);

    const depuis3Mois = new Date();
    depuis3Mois.setMonth(depuis3Mois.getMonth() - 3);
    const depuis6MoisPrev = new Date();
    depuis6MoisPrev.setMonth(depuis6MoisPrev.getMonth() - 6);

    const [
      bonsCommande, fournisseurs, receptionsValidees, lignesQualite,
      importations, poParPDV, stocksDispo, ventesAgg3Mois, poNonSoldes,
      echeancesCreditDues, echeancesPackDues, ventesDirectesRecentes,
    ] = await Promise.all([
      prisma.bonCommande.findMany({
        where: { dateCommande: { gte: depuis6Mois }, statut: { not: "CANCELLED" } },
        select: { statut: true, montantTotal: true, dateCommande: true, pointDeVenteId: true },
      }),
      prisma.fournisseur.findMany({
        where: { actif: true },
        select: { id: true, nom: true, code: true, noteGlobale: true },
      }),
      prisma.receptionApprovisionnement.findMany({
        where: { statut: "VALIDE", dateReception: { not: null } },
        select: { fournisseurId: true, datePrevisionnelle: true, dateReception: true },
      }),
      prisma.ligneReceptionAppro.findMany({
        where: { etatQualite: { not: null } },
        select: { etatQualite: true, reception: { select: { fournisseurId: true } } },
      }),
      prisma.importation.findMany({
        select: {
          dateETA: true, dateArriveeReelle: true,
          bonCommande: { select: { statutLivraison: true } },
        },
      }),
      prisma.bonCommande.groupBy({
        by: ["pointDeVenteId"],
        where: { statut: { in: STATUT_NON_ANNULE } },
        _sum: { montantTotal: true },
        _count: { _all: true },
      }),
      prisma.stockSite.findMany({
        where: { disponible: true, quantite: { gt: 0 } },
        select: {
          produitId: true, pointDeVenteId: true, quantite: true,
          stockMax: true, stockMin: true, seuilCritique: true,
          produit: {
            select: {
              id: true, nom: true, codeProduit: true, prixAchat: true, prixUnitaire: true,
              fournisseurPrincipalId: true,
              fournisseursSecondaires: { select: { id: true, nom: true } },
            },
          },
          pointDeVente: { select: { id: true, nom: true } },
        },
      }),
      prisma.mouvementStock.groupBy({
        by: ["produitId", "pointDeVenteId"],
        where: { type: "SORTIE", typeSortie: { in: [...TYPES_SORTIE_CLIENT] }, dateMouvement: { gte: depuis3Mois } },
        _sum: { quantite: true },
      }),
      // §14 Finances — factures fournisseurs à payer + prévisions de trésorerie.
      // Pas de scope 6 mois ici : un PO plus ancien encore non soldé doit rester compté.
      prisma.bonCommande.findMany({
        where: { statut: { in: STATUT_NON_ANNULE }, montantTotal: { gt: 0 } },
        select: {
          montantTotal: true, montantPaye: true, dateLivraisonPrevue: true,
          fournisseur: { select: { id: true, nom: true } },
        },
      }),
      // ── Entrées prévisionnelles (trésorerie) ────────────────────────────
      // Crédits clients : échéances non soldées, déjà planifiées avec une date réelle.
      prisma.echeanceCredit.findMany({
        where: { statut: { in: ["EN_ATTENTE", "PARTIEL", "EN_RETARD"] } },
        select: { dateEcheance: true, montantDu: true, montantPaye: true },
      }),
      // Souscriptions (collecte) : mêmes principe via l'échéancier de pack.
      prisma.echeancePack.findMany({
        where: { statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
        select: { datePrevue: true, montant: true },
      }),
      // Ventes directes : pas de date future (encaissées comptant) — utilisées
      // comme flux récurrent moyen, pas dans l'échéancier daté.
      prisma.venteDirecte.aggregate({
        where: { createdAt: { gte: depuis3Mois }, statut: { notIn: ["BROUILLON", "ANNULEE", "CREDIT_REFUSE"] } },
        _sum: { montantPaye: true },
      }),
    ]);

    // ── §14 — Rotation des stocks (sorties 6 mois vs valeur stock actuelle) ─
    const ventesAgg6MoisParProduit = await prisma.mouvementStock.groupBy({
      by: ["produitId"],
      where: { type: "SORTIE", typeSortie: { in: [...TYPES_SORTIE_CLIENT] }, dateMouvement: { gte: depuis6Mois } },
      _sum: { quantite: true },
    });
    const produitIdsVentes = ventesAgg6MoisParProduit.map((v) => v.produitId);
    const produitsPrix = produitIdsVentes.length > 0
      ? await prisma.produit.findMany({ where: { id: { in: produitIdsVentes } }, select: { id: true, prixAchat: true, prixUnitaire: true } })
      : [];
    const prixParProduit = new Map(produitsPrix.map((p) => [p.id, Number(p.prixAchat ?? p.prixUnitaire)]));

    // ── §14 — Économie réalisée (écart entre le prix retenu et la moyenne des
    // autres cotations RFQ sur la même demande, uniquement si favorable) ────
    const rfqCloturees = await prisma.demandeCotation.findMany({
      where: { statut: "CLOTUREE", dateCloture: { gte: depuis6Mois }, fournisseurRetenuId: { not: null } },
      select: {
        quantite: true, fournisseurRetenuId: true,
        reponses: { where: { statut: { in: ["RECUE", "RETENUE"] }, prixUnitaire: { not: null } }, select: { fournisseurId: true, prixUnitaire: true } },
      },
    });

    // ── Achats ──────────────────────────────────────────────────────────
    const moisBuckets = new Map<string, { label: string; valeur: number; nb: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(depuis6Mois); d.setMonth(d.getMonth() + i);
      moisBuckets.set(moisKey(d), { label: moisLabel(d), valeur: 0, nb: 0 });
    }
    let valeurEngageeTotal = 0, nbPOEnCours = 0;
    const maintenant = new Date();
    const moisCourantKey = moisKey(maintenant);
    let valeurCeMois = 0, nbPOCeMois = 0;
    for (const po of bonsCommande) {
      const montant = Number(po.montantTotal);
      const k = moisKey(po.dateCommande);
      const bucket = moisBuckets.get(k);
      if (bucket) { bucket.valeur += montant; bucket.nb += 1; }
      if (STATUT_ENGAGE.includes(po.statut)) { valeurEngageeTotal += montant; nbPOEnCours += 1; }
      if (k === moisCourantKey) { valeurCeMois += montant; nbPOCeMois += 1; }
    }
    const evolutionMensuelle = Array.from(moisBuckets.values());

    let aTemps = 0;
    for (const r of receptionsValidees) if (r.dateReception! <= r.datePrevisionnelle) aTemps += 1;
    const tauxLivraisonATemps = receptionsValidees.length > 0
      ? Math.round((aTemps / receptionsValidees.length) * 100) : null;

    // ── Fournisseurs — évaluation (délais/qualité) agrégée par fournisseur ─
    const parFournisseur = new Map<number, { aTemps: number; total: number; conformes: number; totalQualite: number }>();
    const get = (id: number) => {
      let e = parFournisseur.get(id);
      if (!e) { e = { aTemps: 0, total: 0, conformes: 0, totalQualite: 0 }; parFournisseur.set(id, e); }
      return e;
    };
    for (const r of receptionsValidees) {
      if (r.fournisseurId == null) continue;
      const e = get(r.fournisseurId);
      e.total += 1;
      if (r.dateReception! <= r.datePrevisionnelle) e.aTemps += 1;
    }
    for (const l of lignesQualite) {
      const fid = l.reception.fournisseurId;
      if (fid == null) continue;
      const e = get(fid);
      e.totalQualite += 1;
      if (l.etatQualite === "BON") e.conformes += 1;
    }

    // ── §16 — Tendance fournisseur (fenêtre récente vs précédente, délais) ─
    const parFournisseurTendance = new Map<number, { aTempsR: number; totalR: number; aTempsP: number; totalP: number }>();
    const getT = (id: number) => {
      let e = parFournisseurTendance.get(id);
      if (!e) { e = { aTempsR: 0, totalR: 0, aTempsP: 0, totalP: 0 }; parFournisseurTendance.set(id, e); }
      return e;
    };
    for (const r of receptionsValidees) {
      if (r.fournisseurId == null || !r.dateReception) continue;
      const enDelai = r.dateReception <= r.datePrevisionnelle;
      if (r.dateReception >= depuis3Mois) {
        const e = getT(r.fournisseurId); e.totalR += 1; if (enDelai) e.aTempsR += 1;
      } else if (r.dateReception >= depuis6MoisPrev) {
        const e = getT(r.fournisseurId); e.totalP += 1; if (enDelai) e.aTempsP += 1;
      }
    }

    const evalues = fournisseurs.map((f) => {
      const e = parFournisseur.get(f.id);
      const tauxRespectDelais = e && e.total > 0 ? Math.round((e.aTemps / e.total) * 100) : null;
      const tauxQualite = e && e.totalQualite > 0 ? Math.round((e.conformes / e.totalQualite) * 100) : null;
      const t = parFournisseurTendance.get(f.id);
      const tauxR = t && t.totalR > 0 ? Math.round((t.aTempsR / t.totalR) * 100) : null;
      const tauxP = t && t.totalP > 0 ? Math.round((t.aTempsP / t.totalP) * 100) : null;
      const { tendance, deltaPoints } = tendanceFournisseur(tauxR, tauxP, 2, t?.totalR ?? 0, t?.totalP ?? 0);
      return {
        id: f.id, nom: f.nom, code: f.code,
        noteGlobale: f.noteGlobale != null ? Number(f.noteGlobale) : null,
        tauxRespectDelais, tauxQualite,
        echantillon: (e?.total ?? 0) + (e?.totalQualite ?? 0),
        tendance, deltaPoints,
      };
    });
    const topEvalues = evalues
      .filter((f) => f.tauxRespectDelais != null || f.tauxQualite != null || f.noteGlobale != null)
      .sort((a, b) => {
        const scoreA = a.noteGlobale ?? ((a.tauxRespectDelais ?? 50) + (a.tauxQualite ?? 50)) / 2;
        const scoreB = b.noteGlobale ?? ((b.tauxRespectDelais ?? 50) + (b.tauxQualite ?? 50)) / 2;
        return scoreB - scoreA;
      })
      .slice(0, 10);
    const aRisque = evalues
      .filter((f) => f.echantillon >= 3 && ((f.tauxRespectDelais != null && f.tauxRespectDelais < 70) || (f.tauxQualite != null && f.tauxQualite < 70)))
      .sort((a, b) => (a.tauxRespectDelais ?? 100) - (b.tauxRespectDelais ?? 100))
      .slice(0, 10);

    // ── Importations ────────────────────────────────────────────────────
    const parStatut: Record<string, number> = {};
    let sommeEcartsJours = 0, nbEcarts = 0;
    for (const imp of importations) {
      const statut = imp.bonCommande.statutLivraison ?? "PREPARATION";
      parStatut[statut] = (parStatut[statut] ?? 0) + 1;
      if (imp.dateETA && imp.dateArriveeReelle) {
        const ecart = (imp.dateArriveeReelle.getTime() - imp.dateETA.getTime()) / 86_400_000;
        sommeEcartsJours += ecart; nbEcarts += 1;
      }
    }
    const ecartMoyenJours = nbEcarts > 0 ? Math.round((sommeEcartsJours / nbEcarts) * 10) / 10 : null;

    // ── Réseau (par PDV) — avec géolocalisation (§3/§4) si renseignée, et
    // rattachement à la plateforme régionale (§4) pour le regroupement "par
    // région" du dashboard (§14) — pas de champ "région" libre sur PointDeVente,
    // la hiérarchie de dépôts existante joue ce rôle.
    const pdvIds = poParPDV.map((g) => g.pointDeVenteId);
    const pdvs = pdvIds.length > 0
      ? await prisma.pointDeVente.findMany({
          where: { id: { in: pdvIds } },
          select: { id: true, nom: true, code: true, latitude: true, longitude: true, plateformeRegionale: { select: { id: true, nom: true } } },
        })
      : [];
    const pdvById = new Map(pdvs.map((p) => [p.id, p]));
    const reseau = poParPDV
      .map((g) => ({
        pointDeVenteId: g.pointDeVenteId,
        nom: pdvById.get(g.pointDeVenteId)?.nom ?? "—",
        code: pdvById.get(g.pointDeVenteId)?.code ?? "—",
        latitude: pdvById.get(g.pointDeVenteId)?.latitude ?? null,
        longitude: pdvById.get(g.pointDeVenteId)?.longitude ?? null,
        regionNom: pdvById.get(g.pointDeVenteId)?.plateformeRegionale?.nom ?? "Sans région",
        valeurEngagee: Number(g._sum.montantTotal ?? 0),
        nbPO: g._count._all,
      }))
      .sort((a, b) => b.valeurEngagee - a.valeurEngagee);

    const parRegionMap = new Map<string, { region: string; valeurEngagee: number; nbPO: number; nbSites: number }>();
    for (const r of reseau) {
      const e = parRegionMap.get(r.regionNom) ?? { region: r.regionNom, valeurEngagee: 0, nbPO: 0, nbSites: 0 };
      e.valeurEngagee += r.valeurEngagee; e.nbPO += r.nbPO; e.nbSites += 1;
      parRegionMap.set(r.regionNom, e);
    }
    const reseauParRegion = Array.from(parRegionMap.values()).sort((a, b) => b.valeurEngagee - a.valeurEngagee);

    // ── §16 — Ruptures anticipées (couverture de stock projetée) + recommandation
    // "quand / combien / chez qui" : couverture (quand), écart au stock cible
    // (combien), meilleur fournisseur évalué parmi principal+secondaires (chez qui).
    const ventesMap = new Map(ventesAgg3Mois.map((v) => [`${v.produitId}:${v.pointDeVenteId}`, Number(v._sum.quantite ?? 0)]));
    const scoreFournisseur = new Map(evalues.map((f) => [f.id, f.noteGlobale ?? ((f.tauxRespectDelais ?? 50) + (f.tauxQualite ?? 50)) / 2]));
    const nomFournisseur = new Map(fournisseurs.map((f) => [f.id, f.nom]));

    const rupturesAnticipees = stocksDispo
      .map((s) => {
        const moyenneMensuelle = (ventesMap.get(`${s.produitId}:${s.pointDeVenteId}`) ?? 0) / 3;
        const couverture = calculerCouvertureStock(s.quantite, moyenneMensuelle);

        const cible = s.stockMax ?? (s.stockMin != null ? s.stockMin * 2 : null) ?? (s.seuilCritique != null ? s.seuilCritique * 3 : null);
        const quantiteRecommandee = cible != null ? Math.max(0, Math.round(cible - s.quantite)) : null;

        const candidats = [
          ...(s.produit.fournisseurPrincipalId != null ? [s.produit.fournisseurPrincipalId] : []),
          ...s.produit.fournisseursSecondaires.map((f) => f.id),
        ];
        let fournisseurRecommande: { id: number; nom: string } | null = null;
        if (candidats.length > 0) {
          const meilleurId = candidats.reduce((best, id) =>
            (scoreFournisseur.get(id) ?? 50) > (scoreFournisseur.get(best) ?? 50) ? id : best, candidats[0]);
          const nom = nomFournisseur.get(meilleurId);
          if (nom) fournisseurRecommande = { id: meilleurId, nom };
        }

        return {
          produit: { id: s.produit.id, nom: s.produit.nom, codeProduit: s.produit.codeProduit },
          pointDeVente: s.pointDeVente, quantite: s.quantite, quantiteRecommandee, fournisseurRecommande, ...couverture,
        };
      })
      .filter((p) => p.niveau !== "OK")
      .sort((a, b) => (a.joursCouverture ?? 9999) - (b.joursCouverture ?? 9999))
      .slice(0, 15);

    // ── §14 — Valeur du stock, rotation, produits dormants ─────────────────
    // `stocksDispo` est un stock PAR SITE (StockSite) : un même produit dormant sur
    // plusieurs agences apparaît plusieurs fois — on agrège par produit (le tableau
    // "Produits dormants" est au niveau produit, pas produit×site).
    let valeurStockTotal = 0;
    const dormantsMap = new Map<number, { produitId: number; nom: string; codeProduit: string | null; quantite: number; valeur: number }>();
    for (const s of stocksDispo) {
      const prixRef = Number(s.produit.prixAchat ?? s.produit.prixUnitaire);
      const valeur = s.quantite * prixRef;
      valeurStockTotal += valeur;
      const vendu3Mois = ventesMap.get(`${s.produitId}:${s.pointDeVenteId}`) ?? 0;
      if (vendu3Mois === 0) {
        const e = dormantsMap.get(s.produitId) ?? { produitId: s.produitId, nom: s.produit.nom, codeProduit: s.produit.codeProduit, quantite: 0, valeur: 0 };
        e.quantite += s.quantite; e.valeur += valeur;
        dormantsMap.set(s.produitId, e);
      }
    }
    const dormants = Array.from(dormantsMap.values()).sort((a, b) => b.valeur - a.valeur);
    const valeurSorties6Mois = ventesAgg6MoisParProduit.reduce(
      (acc, v) => acc + Number(v._sum.quantite ?? 0) * (prixParProduit.get(v.produitId) ?? 0), 0,
    );
    const rotationStock = valeurStockTotal > 0 ? Math.round((valeurSorties6Mois / valeurStockTotal) * 100) / 100 : null;

    let economieRealisee = 0;
    for (const rfq of rfqCloturees) {
      const retenue = rfq.reponses.find((r) => r.fournisseurId === rfq.fournisseurRetenuId);
      const autres = rfq.reponses.filter((r) => r.fournisseurId !== rfq.fournisseurRetenuId);
      if (!retenue?.prixUnitaire || autres.length === 0) continue;
      const moyenneAutres = autres.reduce((s, r) => s + Number(r.prixUnitaire), 0) / autres.length;
      const gain = (moyenneAutres - Number(retenue.prixUnitaire)) * rfq.quantite;
      if (gain > 0) economieRealisee += gain;
    }

    // ── §14 — Factures fournisseurs à payer (solde dû par PO) + prévisions de
    // trésorerie (échéancier par ancienneté, faute de date d'échéance dédiée
    // sur le PO — proxy assumé sur dateLivraisonPrevue) ─────────────────────
    const facturesNonSoldees = poNonSoldes
      .map((po) => ({ ...po, soldeDu: Number(po.montantTotal) - Number(po.montantPaye) }))
      .filter((po) => po.soldeDu > 0.01);

    const parFournisseurDu = new Map<number, { nom: string; solde: number; nbFactures: number }>();
    for (const f of facturesNonSoldees) {
      const e = parFournisseurDu.get(f.fournisseur.id) ?? { nom: f.fournisseur.nom, solde: 0, nbFactures: 0 };
      e.solde += f.soldeDu; e.nbFactures += 1;
      parFournisseurDu.set(f.fournisseur.id, e);
    }
    const facturesAPayer = {
      total: facturesNonSoldees.reduce((s, f) => s + f.soldeDu, 0),
      nbFactures: facturesNonSoldees.length,
      parFournisseur: Array.from(parFournisseurDu.entries())
        .map(([id, v]) => ({ fournisseurId: id, ...v }))
        .sort((a, b) => b.solde - a.solde)
        .slice(0, 10),
    };

    const echeancier = { enRetard: 0, sous30j: 0, sous60j: 0, sous90j: 0, nonPlanifie: 0 };
    for (const f of facturesNonSoldees) {
      if (!f.dateLivraisonPrevue) { echeancier.nonPlanifie += f.soldeDu; continue; }
      const jours = Math.floor((f.dateLivraisonPrevue.getTime() - maintenant.getTime()) / 86_400_000);
      if (jours < 0) echeancier.enRetard += f.soldeDu;
      else if (jours <= 30) echeancier.sous30j += f.soldeDu;
      else if (jours <= 60) echeancier.sous60j += f.soldeDu;
      else if (jours <= 90) echeancier.sous90j += f.soldeDu;
      else echeancier.nonPlanifie += f.soldeDu;
    }

    // ── Entrées prévisionnelles : crédits clients (remboursements) +
    // souscriptions (collecte) — même logique d'échéancier par ancienneté que
    // les sorties, pour donner une vraie position nette de trésorerie plutôt
    // qu'un simple relevé de factures à payer. ──────────────────────────────
    const bucketDate = (buckets: typeof echeancier, date: Date, montant: number) => {
      const jours = Math.floor((date.getTime() - maintenant.getTime()) / 86_400_000);
      if (jours < 0) buckets.enRetard += montant;
      else if (jours <= 30) buckets.sous30j += montant;
      else if (jours <= 60) buckets.sous60j += montant;
      else if (jours <= 90) buckets.sous90j += montant;
      else buckets.nonPlanifie += montant;
    };

    const entrees = { enRetard: 0, sous30j: 0, sous60j: 0, sous90j: 0, nonPlanifie: 0 };
    for (const e of echeancesCreditDues) {
      const solde = Number(e.montantDu) - Number(e.montantPaye);
      if (solde > 0.01) bucketDate(entrees, e.dateEcheance, solde);
    }
    for (const e of echeancesPackDues) {
      bucketDate(entrees, e.datePrevue, Number(e.montant));
    }
    const totalEntreesEcheancier = entrees.enRetard + entrees.sous30j + entrees.sous60j + entrees.sous90j + entrees.nonPlanifie;
    const ventesDirectesMoyenneMensuelle = Number(ventesDirectesRecentes._sum.montantPaye ?? 0) / 3;

    const positionNette = {
      enRetard: entrees.enRetard - echeancier.enRetard,
      sous30j: entrees.sous30j - echeancier.sous30j,
      sous60j: entrees.sous60j - echeancier.sous60j,
      sous90j: entrees.sous90j - echeancier.sous90j,
      nonPlanifie: entrees.nonPlanifie - echeancier.nonPlanifie,
    };

    const fournisseursEnDegradation = evalues
      .filter((f) => f.tendance === "DEGRADATION")
      .sort((a, b) => (a.deltaPoints ?? 0) - (b.deltaPoints ?? 0))
      .slice(0, 5);
    const fournisseursEnAmelioration = evalues
      .filter((f) => f.tendance === "AMELIORATION")
      .sort((a, b) => (b.deltaPoints ?? 0) - (a.deltaPoints ?? 0))
      .slice(0, 5);

    return NextResponse.json({
      data: {
        achats: {
          valeurEngageeTotal, nbPOEnCours, valeurCeMois, nbPOCeMois,
          tauxLivraisonATemps, evolutionMensuelle, economieRealisee,
        },
        fournisseurs: { actifs: fournisseurs.length, topEvalues, aRisque },
        importations: { total: importations.length, parStatut, ecartMoyenJours },
        reseau,
        reseauParRegion,
        stocks: {
          valeurStockTotal,
          rotationStock,
          produitsDormants: { total: dormants.length, top: dormants.slice(0, 10) },
        },
        previsions: { rupturesAnticipees, fournisseursEnDegradation, fournisseursEnAmelioration },
        finances: {
          engagementFournisseurs: valeurEngageeTotal,
          facturesAPayer,
          previsionsTresorerie: {
            sorties: echeancier,
            entrees,
            totalEntreesEcheancier,
            ventesDirectesMoyenneMensuelle,
            positionNette,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET /logistique/dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
