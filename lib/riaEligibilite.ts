import type { Prisma, ClasseRisqueRIA, NiveauRisque, StatutEligibiliteRIA } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ── Seuils par défaut (Étape 3 — sélection des clients à financer) ──────────────
// Ajustables ici tant qu'aucune config en base n'est introduite.
export const SEUILS_RIA = {
  ancienneteMinJours: 90,   // ancienneté minimale du client
  scoreSolvabiliteMin: 50,  // score de solvabilité minimal (0–100)
  // Pondérations du score d'éligibilité global (somme = 100) : la solvabilité
  // commerciale domine, modulée par l'ancienneté et le niveau de risque.
  poids: { solvabilite: 70, anciennete: 15, risque: 15 },
};

// Statuts utiles aux agrégats crédits.
const CREDIT_STATUTS_EN_COURS = ["EN_ATTENTE_VALIDATION", "VALIDE", "ACTIF", "EN_RETARD"] as const;
const CREDIT_STATUTS_COMPTES  = ["EN_ATTENTE_VALIDATION", "VALIDE", "ACTIF", "EN_RETARD", "SOLDE"] as const; // hors ANNULE/REJETE

const RISQUE_SCORE: Record<NiveauRisque, number> = {
  FAIBLE: 100, MOYEN: 66, ELEVE: 33, CRITIQUE: 0,
};

export interface CriteresRIA {
  ancienneteJours: number;
  nbAchats: number;
  volumeAchats: number;
  scoreSolvabilite: number | null;
  niveauRisque: NiveauRisque | null;
  rotationCommerciale: number; // achats / an
  // Historique crédits & packs
  nbCredits: number;        // crédits comptés (hors annulés/rejetés)
  nbCreditsSoldes: number;  // crédits intégralement remboursés
  nbCreditsEnCours: number; // crédits en cours
  nbCreditsRetard: number;  // crédits actuellement en retard
  volumeCredits: number;    // montant total des crédits
  nbPacks: number;          // souscriptions packs (hors annulées)
}

export interface ResultatEligibiliteRIA {
  criteres: CriteresRIA;
  scoreEligibilite: number;        // 0–100
  classeRisque: ClasseRisqueRIA;   // A–E
  statut: Extract<StatutEligibiliteRIA, "ELIGIBLE" | "REFUSE">;
  motifs: string[];                // raisons de refus / alertes
}

function classeDepuisScore(score: number): ClasseRisqueRIA {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "E";
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const RISQUE_DEPUIS_SCORE = (score: number): NiveauRisque =>
  score >= 60 ? "FAIBLE" : score >= 40 ? "MOYEN" : score >= 20 ? "ELEVE" : "CRITIQUE";

export interface SolvabiliteArgs {
  nbAchats: number;
  volumeAchats: number;
  nbCredits: number;
  nbCreditsSoldes: number;
  nbCreditsEnCours: number;
  nbCreditsRetard: number;
  volumeCredits: number;
  nbPacks: number;
  volumePacks: number;
  montantVersePacks: number;
}

/**
 * Solvabilité d'éligibilité (0–100) calculée UNIQUEMENT sur l'historique
 * commercial réel : ventes directes + crédits clients + souscriptions packs.
 * N'utilise jamais les financements RIA (par définition inexistants à ce stade)
 * ni le score solvabilité admin (circulaire).
 *
 *  - Fiabilité de remboursement (50) : crédits soldés vs retards + taux de
 *    versement des packs, pondérés par le nombre d'engagements de chaque source.
 *  - Volume d'affaires (35) : ventes + crédits + packs cumulés, par paliers FCFA.
 *  - Profondeur de relation (15) : nombre total d'engagements.
 *
 * Le niveau de risque en découle (forcé à ELEVE minimum si crédit en retard).
 */
export function calculerSolvabiliteEligibilite(a: SolvabiliteArgs): { score: number; niveauRisque: NiveauRisque } {
  // ── Fiabilité (50) — moyenne pondérée des signaux disponibles ────────────────
  let fiabilite = 0.5; // neutre si aucun crédit ni pack exploitable
  const signaux: { val: number; poids: number }[] = [];
  if (a.nbCredits > 0) {
    const fc = clamp01((a.nbCreditsSoldes + 0.5 * a.nbCreditsEnCours) / a.nbCredits - (a.nbCreditsRetard > 0 ? 0.3 : 0));
    signaux.push({ val: fc, poids: a.nbCredits });
  }
  if (a.nbPacks > 0 && a.volumePacks > 0) {
    const fp = clamp01(a.montantVersePacks / a.volumePacks);
    signaux.push({ val: fp, poids: a.nbPacks });
  }
  if (signaux.length > 0) {
    const totalPoids = signaux.reduce((s, x) => s + x.poids, 0);
    fiabilite = signaux.reduce((s, x) => s + x.val * x.poids, 0) / totalPoids;
  }
  const ptsFiabilite = fiabilite * 50;

  // ── Volume d'affaires (35) — ventes + crédits + packs ────────────────────────
  const volume = a.volumeAchats + a.volumeCredits + a.volumePacks;
  let ptsVolume = 0;
  if      (volume >= 5_000_000) ptsVolume = 35;
  else if (volume >= 2_000_000) ptsVolume = 30;
  else if (volume >= 1_000_000) ptsVolume = 25;
  else if (volume >= 500_000)   ptsVolume = 19;
  else if (volume >= 200_000)   ptsVolume = 13;
  else if (volume >= 100_000)   ptsVolume = 9;
  else if (volume >= 50_000)    ptsVolume = 5;
  else if (volume > 0)          ptsVolume = 2;

  // ── Profondeur de relation (15) — nb total d'engagements ─────────────────────
  const engagements = a.nbAchats + a.nbCredits + a.nbPacks;
  let ptsProfondeur = 0;
  if      (engagements >= 20) ptsProfondeur = 15;
  else if (engagements >= 10) ptsProfondeur = 12;
  else if (engagements >= 5)  ptsProfondeur = 9;
  else if (engagements >= 3)  ptsProfondeur = 6;
  else if (engagements >= 1)  ptsProfondeur = 3;

  const score = Math.round(Math.min(100, ptsFiabilite + ptsVolume + ptsProfondeur));

  // Risque : dérivé du score, dégradé à ELEVE minimum en cas de retard en cours.
  let niveauRisque = RISQUE_DEPUIS_SCORE(score);
  if (a.nbCreditsRetard > 0 && (niveauRisque === "FAIBLE" || niveauRisque === "MOYEN")) {
    niveauRisque = "ELEVE";
  }

  return { score, niveauRisque };
}

/**
 * Charge l'historique réel d'un client (ventes directes, crédits, souscriptions
 * packs) puis applique les règles d'éligibilité RIA. Décision 100 % automatique
 * — le RVC se contente de valider (ou non) un client ÉLIGIBLE pour le rendre
 * affectable aux investisseurs RIA. Aucune notion de « montant demandé » :
 * il s'agit d'un filtre fondé sur le profil du client.
 */
export async function evaluerEligibiliteClientRIA(
  tx: TX,
  clientId: number,
): Promise<ResultatEligibiliteRIA> {
  const client = await tx.client.findUnique({
    where: { id: clientId },
    select: { id: true, createdAt: true, etat: true },
  });
  if (!client) throw new Error("Client introuvable");

  // ── Ancienneté ───────────────────────────────────────────────────────────────
  const ancienneteJours = Math.max(
    0,
    Math.floor((Date.now() - new Date(client.createdAt).getTime()) / 86400000),
  );

  // ── Ventes directes (transactions réelles, hors annulées/brouillons) ──────────
  const ventes = await tx.venteDirecte.aggregate({
    where: { clientId, statut: { notIn: ["ANNULEE", "BROUILLON"] } },
    _count: { _all: true },
    _sum: { montantTotal: true },
  });
  const nbAchats     = ventes._count._all;
  const volumeAchats = Number(ventes._sum.montantTotal ?? 0);

  const ancienneteAns       = ancienneteJours / 365;
  const rotationCommerciale = ancienneteAns >= 0.25 ? nbAchats / Math.max(ancienneteAns, 1) : nbAchats;

  // ── Crédits clients (comportement de remboursement) ───────────────────────────
  const credits = await tx.creditClient.findMany({
    where: { clientId, statut: { in: [...CREDIT_STATUTS_COMPTES] } },
    select: { statut: true, montantTotal: true },
  });
  const nbCredits        = credits.length;
  const nbCreditsSoldes  = credits.filter((c) => c.statut === "SOLDE").length;
  const nbCreditsRetard  = credits.filter((c) => c.statut === "EN_RETARD").length;
  const nbCreditsEnCours = credits.filter((c) => (CREDIT_STATUTS_EN_COURS as readonly string[]).includes(c.statut)).length;
  const volumeCredits    = credits.reduce((s, c) => s + Number(c.montantTotal ?? 0), 0);

  // ── Souscriptions packs (engagement + discipline de versement, hors annulées) ──
  const packs = await tx.souscriptionPack.findMany({
    where: { clientId, statut: { not: "ANNULE" } },
    select: { montantTotal: true, montantVerse: true },
  });
  const nbPacks           = packs.length;
  const volumePacks       = packs.reduce((s, x) => s + Number(x.montantTotal ?? 0), 0);
  const montantVersePacks = packs.reduce((s, x) => s + Number(x.montantVerse ?? 0), 0);

  // ── Solvabilité & risque calculés sur l'historique commercial réel ────────────
  const solva = calculerSolvabiliteEligibilite({
    nbAchats, volumeAchats,
    nbCredits, nbCreditsSoldes, nbCreditsEnCours, nbCreditsRetard, volumeCredits,
    nbPacks, volumePacks, montantVersePacks,
  });
  const scoreSolvabilite = solva.score;
  const niveauRisque     = solva.niveauRisque;

  const criteres: CriteresRIA = {
    ancienneteJours, nbAchats, volumeAchats,
    scoreSolvabilite, niveauRisque, rotationCommerciale,
    nbCredits, nbCreditsSoldes, nbCreditsEnCours, nbCreditsRetard, volumeCredits, nbPacks,
  };

  // ── Règles de refus automatique ──────────────────────────────────────────────
  const motifs: string[] = [];

  if (client.etat !== "ACTIF") {
    motifs.push(`Client non actif (${String(client.etat).toLowerCase()}).`);
  }
  // Filtre : un client sans aucun historique exploitable n'est pas finançable.
  const sansHistorique = nbAchats === 0 && nbCredits === 0 && nbPacks === 0;
  if (sansHistorique) {
    motifs.push("Aucun historique de transaction (ni vente, ni crédit, ni pack).");
  }
  if (niveauRisque === "CRITIQUE") {
    motifs.push("Niveau de risque CRITIQUE — non finançable par le RIA.");
  }
  if (ancienneteJours < SEUILS_RIA.ancienneteMinJours) {
    motifs.push(`Ancienneté insuffisante (${ancienneteJours} j < ${SEUILS_RIA.ancienneteMinJours} j requis).`);
  }
  // Solvabilité : ne bloque que si elle s'appuie sur un historique réel (sinon le
  // motif « aucun historique » suffit et on évite de pénaliser un profil naissant).
  if (!sansHistorique && scoreSolvabilite < SEUILS_RIA.scoreSolvabiliteMin) {
    motifs.push(`Solvabilité insuffisante (${scoreSolvabilite}/100 < ${SEUILS_RIA.scoreSolvabiliteMin}).`);
  }
  if (nbCreditsRetard > 0) {
    motifs.push(`${nbCreditsRetard} crédit(s) en retard en cours — comportement de remboursement défaillant.`);
  }

  // ── Score d'éligibilité (0–100) : solvabilité commerciale modulée par
  //    l'ancienneté et le niveau de risque ──────────────────────────────────────
  const p = SEUILS_RIA.poids;
  const sSolva = scoreSolvabilite / 100;
  const sAnc   = clamp01(ancienneteJours / 365);
  const sRisq  = RISQUE_SCORE[niveauRisque] / 100;

  const scoreEligibilite = Math.round(
    sSolva * p.solvabilite + sAnc * p.anciennete + sRisq * p.risque,
  );

  const statut = motifs.length === 0 ? "ELIGIBLE" : "REFUSE";

  return {
    criteres,
    scoreEligibilite,
    classeRisque: classeDepuisScore(scoreEligibilite),
    statut,
    motifs,
  };
}
