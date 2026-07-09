import { prisma } from "@/lib/prisma";
import { PrioriteNotification } from "@prisma/client";
import { notifyAdmins } from "@/lib/notifications";

/**
 * Épargne programmée (CDC §19.B).
 * Un plan fixe un objectif chiffré + une cotisation périodique. La progression
 * est calculée à partir du cumul des cotisations (dépôts fléchés) versus le
 * montant théorique attendu à la date du jour.
 */

export type FrequenceEpargne = "QUOTIDIENNE" | "HEBDOMADAIRE" | "MENSUELLE";

// Durée d'une période en jours (approximation calendaire simple et prévisible).
export const JOURS_FREQ: Record<FrequenceEpargne, number> = {
  QUOTIDIENNE: 1,
  HEBDOMADAIRE: 7,
  MENSUELLE: 30,
};

export const FREQ_LABEL: Record<FrequenceEpargne, string> = {
  QUOTIDIENNE: "Quotidienne",
  HEBDOMADAIRE: "Hebdomadaire",
  MENSUELLE: "Mensuelle",
};

const MS_JOUR = 24 * 60 * 60 * 1000;
const jours = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / MS_JOUR);

export interface PlanBase {
  objectifMontant: number | string;
  montantCotisation: number | string;
  montantCumule: number | string;
  frequence: FrequenceEpargne;
  dateDebut: Date | string;
  dateEcheance: Date | string;
  statut: string;
}

export interface Progression {
  objectif: number;
  cumule: number;
  montantRestant: number;
  tauxProgression: number;      // 0–100
  periodesTotales: number;
  periodesEcoulees: number;
  montantAttenduADate: number;  // cotisation × périodes écoulées (plafonné à l'objectif)
  ecart: number;                // cumule − attendu (>0 = avance, <0 = retard)
  enRetard: boolean;
  joursRestants: number;        // négatif si échéance dépassée
  prochaineCotisation: string | null; // ISO date de la prochaine échéance de cotisation
}

/** Calcule les indicateurs de progression d'un plan à une date donnée. */
export function calculerProgression(plan: PlanBase, now: Date = new Date()): Progression {
  const objectif = Number(plan.objectifMontant);
  const cumule = Number(plan.montantCumule);
  const cotisation = Number(plan.montantCotisation);
  const debut = new Date(plan.dateDebut);
  const echeance = new Date(plan.dateEcheance);
  const pas = JOURS_FREQ[plan.frequence] ?? 1;

  const periodesTotales = Math.max(1, Math.ceil(Math.max(0, jours(echeance, debut)) / pas));
  const periodesEcoulees = Math.min(periodesTotales, Math.max(0, Math.floor(Math.max(0, jours(now, debut)) / pas)));
  const montantAttenduADate = Math.min(objectif, Math.round(cotisation * periodesEcoulees));
  const ecart = Math.round(cumule - montantAttenduADate);
  const tauxProgression = objectif > 0 ? Math.min(100, Math.round((cumule / objectif) * 100)) : 0;
  const joursRestants = jours(echeance, now);

  // Prochaine cotisation attendue (uniquement si le plan est en cours et pas échu).
  let prochaineCotisation: string | null = null;
  if (plan.statut === "EN_COURS" && joursRestants >= 0 && cumule < objectif) {
    const prochaine = new Date(debut);
    prochaine.setDate(prochaine.getDate() + (periodesEcoulees + 1) * pas);
    prochaineCotisation = (prochaine > echeance ? echeance : prochaine).toISOString();
  }

  return {
    objectif,
    cumule,
    montantRestant: Math.max(0, Math.round(objectif - cumule)),
    tauxProgression,
    periodesTotales,
    periodesEcoulees,
    montantAttenduADate,
    ecart,
    enRetard: plan.statut === "EN_COURS" && ecart < 0,
    joursRestants,
    prochaineCotisation,
  };
}

/**
 * Traitement automatique des échéances (cron / lazy) :
 *  - passe en EXPIRE les plans EN_COURS dont l'échéance est dépassée sans objectif atteint ;
 *  - notifie les admins pour chaque plan expiré.
 * Les plans dont l'objectif est atteint sont marqués ATTEINT au fil des cotisations.
 */
export async function traiterEcheancesEpargne(): Promise<{ verifies: number; expires: number }> {
  const now = new Date();
  const candidats = await prisma.planEpargne.findMany({
    where: { statut: "EN_COURS", dateEcheance: { lt: now } },
    select: {
      id: true, libelle: true, objectifMontant: true, montantCumule: true,
      compte: { select: { id: true, numeroCompte: true, libelle: true, client: { select: { prenom: true, nom: true } } } },
    },
  });

  let expires = 0;
  for (const p of candidats) {
    const atteint = Number(p.montantCumule) >= Number(p.objectifMontant);
    await prisma.$transaction(async (tx) => {
      await tx.planEpargne.update({
        where: { id: p.id },
        data: atteint
          ? { statut: "ATTEINT", dateAtteint: now }
          : { statut: "EXPIRE" },
      });
      await tx.auditLog.create({
        data: {
          action: atteint ? "PLAN_EPARGNE_ATTEINT" : "PLAN_EPARGNE_EXPIRE",
          entite: "PlanEpargne", entiteId: p.id,
          details: { cumule: Number(p.montantCumule), objectif: Number(p.objectifMontant) },
        },
      });
      if (!atteint) {
        const nom = p.compte.libelle ?? `${p.compte.client.prenom} ${p.compte.client.nom}`;
        await notifyAdmins(tx, {
          titre: "Plan d'épargne échu",
          message: `Le plan « ${p.libelle} » (${nom}) est arrivé à échéance sans atteindre l'objectif (${Number(p.montantCumule).toLocaleString("fr-FR")} / ${Number(p.objectifMontant).toLocaleString("fr-FR")} FCFA).`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/comptes-courants/${p.compte.id}`,
        });
      }
    });
    if (!atteint) expires += 1;
  }

  return { verifies: candidats.length, expires };
}
