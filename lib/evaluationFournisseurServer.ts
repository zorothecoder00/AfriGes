/**
 * lib/evaluationFournisseurServer.ts — Évaluation automatique fournisseur (CDC §8).
 *
 * Calcule les 5 critères du CDC et une note globale, à partir des données déjà
 * en base (réceptions, RFQ, bons de commande, litiges). Chaque critère est
 * `null` tant qu'il n'y a pas assez de données — pas une estimation par défaut.
 * La note globale est la moyenne simple des critères disponibles (pondération
 * égale, se recalcule au fur et à mesure que l'historique s'enrichit).
 */
import { prisma } from "@/lib/prisma";

export interface EvaluationFournisseur {
  tauxRespectDelais: number | null;
  receptionsAnalysees: number;
  tauxQualite: number | null;
  lignesAnalysees: number;
  scorePrix: number | null;
  rfqAnalysees: number;
  scoreDisponibilite: number | null;
  sollicitationsAnalysees: number;
  scoreLitiges: number | null;
  litigesAnalyses: number;
  noteGlobale: number | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function calculerEvaluationFournisseur(fournisseurId: number): Promise<EvaluationFournisseur> {
  const [receptionsValidees, lignesQualite, reponsesRFQ, bonsCommande, litiges] = await Promise.all([
    // Respect des délais : réceptions validées, comparaison prévu vs réel
    prisma.receptionApprovisionnement.findMany({
      where: { fournisseurId, statut: "VALIDE", dateReception: { not: null } },
      select: { datePrevisionnelle: true, dateReception: true },
    }),
    // Qualité produit : état qualité saisi à la réception
    prisma.ligneReceptionAppro.findMany({
      where: { reception: { fournisseurId }, etatQualite: { not: null } },
      select: { etatQualite: true },
    }),
    // Prix + disponibilité : historique des cotations RFQ de ce fournisseur,
    // avec le prix des AUTRES fournisseurs sur la même RFQ pour comparaison.
    prisma.reponseRFQ.findMany({
      where: { fournisseurId },
      select: {
        statut: true, prixUnitaire: true,
        demande: { select: { reponses: { select: { prixUnitaire: true } } } },
      },
    }),
    // Disponibilité (volet PO) : part des PO honorés (non annulés)
    prisma.bonCommande.findMany({
      where: { fournisseurId },
      select: { statut: true },
    }),
    // Litiges : réclamations ouvertes/résolues contre ce fournisseur
    prisma.litigeFournisseur.findMany({
      where: { fournisseurId },
      select: { statut: true },
    }),
  ]);

  // ── Respect des délais ────────────────────────────────────────────────
  const aTemps = receptionsValidees.filter((r) => r.dateReception! <= r.datePrevisionnelle).length;
  const tauxRespectDelais = receptionsValidees.length > 0
    ? Math.round((aTemps / receptionsValidees.length) * 100)
    : null;

  // ── Qualité produit ────────────────────────────────────────────────────
  const conformes = lignesQualite.filter((l) => l.etatQualite === "BON").length;
  const tauxQualite = lignesQualite.length > 0
    ? Math.round((conformes / lignesQualite.length) * 100)
    : null;

  // ── Prix : ratio prix coté par ce fournisseur vs moyenne des cotations
  //    reçues sur la même RFQ (même produit, même moment, même quantité) ──
  const rfqAvecPrix = reponsesRFQ.filter((r) => r.prixUnitaire != null);
  let scorePrix: number | null = null;
  if (rfqAvecPrix.length > 0) {
    const ratios = rfqAvecPrix.map((r) => {
      const prixAutres = r.demande.reponses
        .map((rr) => rr.prixUnitaire)
        .filter((p): p is NonNullable<typeof p> => p != null)
        .map(Number);
      const moyenne = prixAutres.reduce((s, p) => s + p, 0) / prixAutres.length;
      return moyenne > 0 ? Number(r.prixUnitaire) / moyenne : 1;
    });
    const ratioMoyen = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    scorePrix = Math.round(clamp(100 - (ratioMoyen - 1) * 100, 0, 100));
  }

  // ── Disponibilité : taux de réponse aux sollicitations RFQ + taux de PO
  //    honorés (non annulés) ────────────────────────────────────────────
  const sollicitationsRFQ = reponsesRFQ.length;
  const reponsesRecues = reponsesRFQ.filter((r) => r.statut === "RECUE" || r.statut === "RETENUE").length;
  const tauxReponseRFQ = sollicitationsRFQ > 0 ? reponsesRecues / sollicitationsRFQ : null;

  const totalPO = bonsCommande.length;
  const poAnnules = bonsCommande.filter((po) => po.statut === "CANCELLED").length;
  const tauxPOHonores = totalPO > 0 ? (totalPO - poAnnules) / totalPO : null;

  const sousScoresDispo = [tauxReponseRFQ, tauxPOHonores].filter((v): v is number => v != null);
  const scoreDisponibilite = sousScoresDispo.length > 0
    ? Math.round((sousScoresDispo.reduce((s, v) => s + v, 0) / sousScoresDispo.length) * 100)
    : null;

  // ── Litiges : chaque litige pèse sur le score, les litiges ouverts plus
  //    que les résolus ; pas de note tant qu'il n'y a aucune relation
  //    commerciale (rien à évaluer) ─────────────────────────────────────
  const litigesOuverts = litiges.filter((l) => l.statut === "OUVERT").length;
  const litigesResolus = litiges.filter((l) => l.statut === "RESOLU").length;
  const aDejaUneRelation = receptionsValidees.length > 0 || totalPO > 0 || litiges.length > 0;
  const scoreLitiges = aDejaUneRelation
    ? Math.round(clamp(100 - litigesOuverts * 25 - litigesResolus * 8, 0, 100))
    : null;

  // ── Note globale : moyenne simple des critères disponibles ────────────
  const criteres = [tauxRespectDelais, tauxQualite, scorePrix, scoreDisponibilite, scoreLitiges]
    .filter((v): v is number => v != null);
  const noteGlobale = criteres.length > 0
    ? Math.round(criteres.reduce((s, v) => s + v, 0) / criteres.length)
    : null;

  return {
    tauxRespectDelais, receptionsAnalysees: receptionsValidees.length,
    tauxQualite, lignesAnalysees: lignesQualite.length,
    scorePrix, rfqAnalysees: rfqAvecPrix.length,
    scoreDisponibilite, sollicitationsAnalysees: sollicitationsRFQ,
    scoreLitiges, litigesAnalyses: litiges.length,
    noteGlobale,
  };
}
