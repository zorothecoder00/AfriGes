// lib/popc/tourneeServer.ts
// §10 — Génération automatique de la tournée d'un commercial pour une journée.
// Liste des clients à visiter (échéance du jour ou en retard) avec priorité
// calculée. Serveur uniquement. Aucune ressaisie : tout vient du module Crédit.

import { prisma } from "@/lib/prisma";
import { libelleFormule, type Formule } from "@/lib/formuleCredit";

export type PrioriteTournee = "URGENTE" | "HAUTE" | "NORMALE";

export interface LigneTournee {
  creditId: number;
  reference: string;
  clientId: number;
  clientNom: string;
  telephone: string;
  quartier: string;
  formule: string;          // libellé Quinzaine/Trentaine (— si crédit legacy)
  miseDuJour: number;       // reste à collecter sur l'échéance du jour
  montantRetard: number;    // reste cumulé des échéances en retard
  montantACollecter: number;
  echeance: string;         // ISO — échéance impayée la plus ancienne (ou du jour)
  retardJours: number;      // ancienneté du retard (0 si à jour)
  score: number;
  priorite: PrioriteTournee;
}

const N = (v: unknown) => Number(v ?? 0);

/** Score de priorité (§10 : échéance du jour, retard, montant, ancienneté). */
function scorer(echeanceDuJour: boolean, retardJours: number, montant: number): { score: number; priorite: PrioriteTournee } {
  let score = 0;
  if (retardJours > 0) score += 50 + Math.min(retardJours, 30);   // retard + ancienneté
  else if (echeanceDuJour) score += 30;                            // échéance du jour
  score += Math.min(20, montant / 1000);                          // montant à collecter (borné)
  const priorite: PrioriteTournee = score >= 60 ? "URGENTE" : score >= 30 ? "HAUTE" : "NORMALE";
  return { score: Number(score.toFixed(1)), priorite };
}

/**
 * Génère la tournée d'un agent pour une date donnée (défaut : aujourd'hui).
 * N'inclut que les crédits ayant quelque chose à collecter ce jour (échéance du
 * jour non soldée ou échéances en retard), triés par priorité décroissante.
 */
export async function genererTournee(agentId: number, date?: string): Promise<LigneTournee[]> {
  const base = date ? new Date(date) : new Date();
  const debutJour = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const finJour = new Date(debutJour); finJour.setUTCDate(finJour.getUTCDate() + 1);

  // Portefeuille de l'agent (affectation dédiée ∪ agent legacy).
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { agentTerrainId: agentId },
        { agentAffectations: { some: { agentId, actif: true } } },
      ],
    },
    select: { id: true },
  });
  const clientIds = clients.map((c) => c.id);
  if (clientIds.length === 0) return [];

  // Crédits actifs / en retard, avec les échéances jusqu'à aujourd'hui inclus.
  const credits = await prisma.creditClient.findMany({
    where: { clientId: { in: clientIds }, statut: { in: ["ACTIF", "EN_RETARD"] } },
    select: {
      id: true, reference: true, formule: true,
      client: { select: { id: true, nom: true, prenom: true, telephone: true, quartier: true } },
      echeances: {
        where: { dateEcheance: { lt: finJour } },
        select: { dateEcheance: true, montantDu: true, montantPaye: true, statut: true },
        orderBy: { dateEcheance: "asc" },
      },
    },
  });

  const lignes: LigneTournee[] = [];
  for (const c of credits) {
    let miseDuJour = 0;
    let montantRetard = 0;
    let echeanceDuJour = false;
    let plusAncienneImpayee: Date | null = null;

    for (const e of c.echeances) {
      const reste = Number((N(e.montantDu) - N(e.montantPaye)).toFixed(2));
      if (e.statut === "PAYE" || reste <= 0) continue;
      const estDuJour = e.dateEcheance >= debutJour && e.dateEcheance < finJour;
      if (estDuJour) {
        miseDuJour += reste;
        echeanceDuJour = true;
      } else {
        montantRetard += reste;               // échéance passée impayée
        if (!plusAncienneImpayee) plusAncienneImpayee = e.dateEcheance;
      }
    }

    const montantACollecter = Number((miseDuJour + montantRetard).toFixed(2));
    if (montantACollecter <= 0) continue;      // rien à collecter aujourd'hui

    const retardJours = plusAncienneImpayee
      ? Math.max(0, Math.floor((debutJour.getTime() - plusAncienneImpayee.getTime()) / 86400000))
      : 0;
    const echeance = plusAncienneImpayee ?? debutJour;
    const { score, priorite } = scorer(echeanceDuJour, retardJours, montantACollecter);

    lignes.push({
      creditId: c.id,
      reference: c.reference,
      clientId: c.client.id,
      clientNom: `${c.client.prenom} ${c.client.nom}`.trim(),
      telephone: c.client.telephone,
      quartier: c.client.quartier ?? "—",
      formule: libelleFormule(c.formule as Formule | null),
      miseDuJour: Number(miseDuJour.toFixed(2)),
      montantRetard: Number(montantRetard.toFixed(2)),
      montantACollecter,
      echeance: echeance.toISOString(),
      retardJours,
      score,
      priorite,
    });
  }

  return lignes.sort((a, b) => b.score - a.score);
}
