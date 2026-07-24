import { NextResponse } from "next/server";
import { StatutBonCommande } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "../fournisseurs/route";

const STATUT_ENGAGE: StatutBonCommande[] = [
  "PENDING_APPROVAL", "APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_DELIVERED",
];
const STATUT_NON_ANNULE: StatutBonCommande[] = [...STATUT_ENGAGE, "COMPLETED"];

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
 * - Réseau : pas de coordonnées GPS sur PointDeVente → répartition par agence
 *   (liste), pas de carte.
 * - Finances : "factures à payer" / "prévisions de trésorerie" nécessitent un
 *   module comptabilité fournisseurs/trésorerie inexistant → signalé non
 *   disponible plutôt que simulé.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const depuis6Mois = new Date();
    depuis6Mois.setMonth(depuis6Mois.getMonth() - 5);
    depuis6Mois.setDate(1);
    depuis6Mois.setHours(0, 0, 0, 0);

    const [
      bonsCommande, fournisseurs, receptionsValidees, lignesQualite,
      importations, poParPDV,
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
    ]);

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

    const evalues = fournisseurs.map((f) => {
      const e = parFournisseur.get(f.id);
      const tauxRespectDelais = e && e.total > 0 ? Math.round((e.aTemps / e.total) * 100) : null;
      const tauxQualite = e && e.totalQualite > 0 ? Math.round((e.conformes / e.totalQualite) * 100) : null;
      return {
        id: f.id, nom: f.nom, code: f.code,
        noteGlobale: f.noteGlobale != null ? Number(f.noteGlobale) : null,
        tauxRespectDelais, tauxQualite,
        echantillon: (e?.total ?? 0) + (e?.totalQualite ?? 0),
      };
    });
    const topEvalues = evalues
      .filter((f) => f.tauxRespectDelais != null || f.tauxQualite != null || f.noteGlobale != null)
      .sort((a, b) => {
        const scoreA = a.noteGlobale ?? ((a.tauxRespectDelais ?? 50) + (a.tauxQualite ?? 50)) / 2;
        const scoreB = b.noteGlobale ?? ((b.tauxRespectDelais ?? 50) + (b.tauxQualite ?? 50)) / 2;
        return scoreB - scoreA;
      })
      .slice(0, 5);
    const aRisque = evalues
      .filter((f) => f.echantillon >= 3 && ((f.tauxRespectDelais != null && f.tauxRespectDelais < 70) || (f.tauxQualite != null && f.tauxQualite < 70)))
      .sort((a, b) => (a.tauxRespectDelais ?? 100) - (b.tauxRespectDelais ?? 100))
      .slice(0, 5);

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

    // ── Réseau (par PDV) — pas de GPS, répartition liste ───────────────
    const pdvIds = poParPDV.map((g) => g.pointDeVenteId);
    const pdvs = pdvIds.length > 0
      ? await prisma.pointDeVente.findMany({ where: { id: { in: pdvIds } }, select: { id: true, nom: true, code: true } })
      : [];
    const pdvById = new Map(pdvs.map((p) => [p.id, p]));
    const reseau = poParPDV
      .map((g) => ({
        pointDeVenteId: g.pointDeVenteId,
        nom: pdvById.get(g.pointDeVenteId)?.nom ?? "—",
        code: pdvById.get(g.pointDeVenteId)?.code ?? "—",
        valeurEngagee: Number(g._sum.montantTotal ?? 0),
        nbPO: g._count._all,
      }))
      .sort((a, b) => b.valeurEngagee - a.valeurEngagee);

    return NextResponse.json({
      data: {
        achats: {
          valeurEngageeTotal, nbPOEnCours, valeurCeMois, nbPOCeMois,
          tauxLivraisonATemps, evolutionMensuelle,
        },
        fournisseurs: { actifs: fournisseurs.length, topEvalues, aRisque },
        importations: { total: importations.length, parStatut, ecartMoyenJours },
        reseau,
        finances: {
          engagementFournisseurs: valeurEngageeTotal,
          nonDisponible: [
            "Factures fournisseurs à payer (module comptabilité fournisseurs non implémenté)",
            "Prévisions de trésorerie (module trésorerie non implémenté)",
          ],
        },
      },
    });
  } catch (error) {
    console.error("GET /logistique/dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
