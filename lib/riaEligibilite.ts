import type { Prisma, ClasseRisqueRIA, NiveauRisque, StatutEligibiliteRIA } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ── Seuils par défaut (Étape 3 — sélection des clients à financer) ──────────────
// Ajustables ici tant qu'aucune config en base n'est introduite.
export const SEUILS_RIA = {
  ancienneteMinJours: 90,   // ancienneté minimale du client
  scoreSolvabiliteMin: 50,  // score de solvabilité minimal (0–100)
  // Pondérations du score d'éligibilité global (somme = 100)
  poids: { solvabilite: 40, anciennete: 20, historique: 20, risque: 20 },
};

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

const fcfa = (n: number) => n.toLocaleString("fr-FR");

/**
 * Charge les critères réels d'un client puis applique les règles d'éligibilité RIA.
 * Décision 100 % automatique (« le système valide ou refuse automatiquement »).
 */
export async function evaluerEligibiliteClientRIA(
  tx: TX,
  clientId: number,
  montantDemande: number,
): Promise<ResultatEligibiliteRIA> {
  const client = await tx.client.findUnique({
    where: { id: clientId },
    select: {
      id: true, createdAt: true, etat: true,
      niveauRisque: true, scoreSolvabilite: true,
      limiteCredit: true, soldeActuel: true,
    },
  });
  if (!client) throw new Error("Client introuvable");

  // ── Collecte des critères ───────────────────────────────────────────────────
  const ancienneteJours = Math.max(
    0,
    Math.floor((Date.now() - new Date(client.createdAt).getTime()) / 86400000),
  );

  const ventes = await tx.venteDirecte.aggregate({
    where: { clientId, statut: { not: "ANNULEE" } },
    _count: { _all: true },
    _sum: { montantTotal: true },
  });
  const nbAchats     = ventes._count._all;
  const volumeAchats = Number(ventes._sum.montantTotal ?? 0);

  const ancienneteAns     = ancienneteJours / 365;
  const rotationCommerciale = ancienneteAns >= 0.25 ? nbAchats / Math.max(ancienneteAns, 1) : nbAchats;

  const scoreSolvabilite = client.scoreSolvabilite ?? null;
  const niveauRisque     = client.niveauRisque ?? null;

  const criteres: CriteresRIA = {
    ancienneteJours, nbAchats, volumeAchats,
    scoreSolvabilite, niveauRisque, rotationCommerciale,
  };

  // ── Règles de refus automatique ──────────────────────────────────────────────
  const motifs: string[] = [];

  if (client.etat !== "ACTIF") {
    motifs.push(`Client non actif (${String(client.etat).toLowerCase()}).`);
  }
  if (niveauRisque === "CRITIQUE") {
    motifs.push("Niveau de risque CRITIQUE — non finançable par le RIA.");
  }
  if (ancienneteJours < SEUILS_RIA.ancienneteMinJours) {
    motifs.push(`Ancienneté insuffisante (${ancienneteJours} j < ${SEUILS_RIA.ancienneteMinJours} j requis).`);
  }
  if (scoreSolvabilite !== null && scoreSolvabilite < SEUILS_RIA.scoreSolvabiliteMin) {
    motifs.push(`Solvabilité insuffisante (${Math.round(scoreSolvabilite)}/100 < ${SEUILS_RIA.scoreSolvabiliteMin}).`);
  }

  // Crédit en retard / défaut en cours
  const creditRisque = await tx.creditClient.findFirst({
    where: { clientId, statut: { in: ["EN_RETARD"] } },
    select: { reference: true, soldeRestant: true },
  });
  if (creditRisque) {
    motifs.push(`Crédit en retard en cours (${creditRisque.reference}, solde ${fcfa(Number(creditRisque.soldeRestant))} FCFA).`);
  }

  // Montant demandé vs limite de crédit disponible
  if (client.limiteCredit !== null) {
    const disponible = Math.max(0, Number(client.limiteCredit) - Number(client.soldeActuel ?? 0));
    if (montantDemande > disponible) {
      motifs.push(`Montant demandé (${fcfa(montantDemande)} FCFA) supérieur à la limite disponible (${fcfa(disponible)} FCFA).`);
    }
  }

  // ── Score d'éligibilité (0–100) ──────────────────────────────────────────────
  const p = SEUILS_RIA.poids;
  const sSolva = (scoreSolvabilite ?? 50) / 100;
  const sAnc   = Math.min(1, ancienneteJours / 365);
  const sHist  = Math.min(1, nbAchats / 10);
  const sRisq  = (niveauRisque ? RISQUE_SCORE[niveauRisque] : 50) / 100;
  const scoreEligibilite = Math.round(
    sSolva * p.solvabilite + sAnc * p.anciennete + sHist * p.historique + sRisq * p.risque,
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
