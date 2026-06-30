/**
 * lib/calcCommission.ts — Moteur de commissions de la paie (CDC 13.4).
 *
 * Calcule la commission d'un collaborateur selon le barème associé à son rôle
 * gestionnaire (`profilCible`) et son activité sur la période :
 *   - FIXE        : valeur × nb ventes              (ex. 5 000 F / vente)
 *   - POURCENTAGE : valeur% × CA encaissé           (ex. 3 % du recouvrement)
 *   - PALIER      : taux% du palier (selon nb ventes) × CA encaissé
 *
 * Activité agrégée sur 4 sources (décisions métier AfriSime) :
 *   nb ventes  = ventes directes (hors crédit) + crédits + packs créés sur la période
 *   CA encaissé = montantPaye (ventes comptant) + remboursements crédit CONFIRMÉS
 *                 caissier + versements packs PAYE, sur la période
 * Attribution agent : VenteDirecte.vendeurId · CreditClient.creeParId ·
 *   SouscriptionPack.userId · RemboursementCredit.agentCollecteurId.
 * Anti double comptage : les VenteDirecte liées à un crédit (creditClientId) sont
 *   exclues des ventes directes (le crédit est compté à part, son cash via recouvrements).
 */

import { Prisma } from "@prisma/client";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " F";

const VENTES_EXCLUES = ["BROUILLON", "ANNULEE", "CREDIT_REQUEST"];
const CREDITS_EXCLUS = ["ANNULE", "REJETE"];

export interface ActiviteCommission { nbVentes: number; montantCA: number; }

interface PalierItem { min: number; max: number | null; taux: number; }

/** Calcule le montant de commission selon le type de barème + l'activité. */
export function calculerMontantCommission(
  bareme: { type: string; valeur: Prisma.Decimal | number | null; paliers: Prisma.JsonValue | null },
  act: ActiviteCommission,
): number {
  const valeur = Number(bareme.valeur ?? 0);
  switch (bareme.type) {
    case "FIXE":
      return valeur * act.nbVentes;
    case "POURCENTAGE":
      return (valeur / 100) * act.montantCA;
    case "PALIER": {
      const paliers = Array.isArray(bareme.paliers) ? (bareme.paliers as unknown as PalierItem[]) : [];
      const p = paliers.find(
        (x) => act.nbVentes >= Number(x.min) && (x.max == null || act.nbVentes <= Number(x.max)),
      );
      return p ? (Number(p.taux) / 100) * act.montantCA : 0;
    }
    default:
      return 0;
  }
}

/** Agrège l'activité de commission d'un agent (User) sur une période (mois/annee). */
export async function getActiviteCommission(
  tx: Prisma.TransactionClient,
  userId: number,
  mois: number,
  annee: number,
): Promise<ActiviteCommission> {
  const periode = { gte: new Date(annee, mois - 1, 1), lt: new Date(annee, mois, 1) };

  const [nbVD, nbCredits, nbPacks, caComptant, caRecouvrement, caPacks] = await Promise.all([
    // nb ventes directes (comptant, hors crédit)
    tx.venteDirecte.count({
      where: { vendeurId: userId, creditClientId: null, statut: { notIn: VENTES_EXCLUES as never }, createdAt: periode },
    }),
    // nb crédits créés
    tx.creditClient.count({
      where: { creeParId: userId, statut: { notIn: CREDITS_EXCLUS as never }, createdAt: periode },
    }),
    // nb packs souscrits
    tx.souscriptionPack.count({
      where: { userId, statut: { not: "ANNULE" as never }, createdAt: periode },
    }),
    // CA comptant encaissé (montantPaye des ventes comptant)
    tx.venteDirecte.aggregate({
      where: { vendeurId: userId, creditClientId: null, statut: { notIn: VENTES_EXCLUES as never }, createdAt: periode },
      _sum: { montantPaye: true },
    }),
    // CA recouvrements crédit de l'agent — comptés au mois de CONFIRMATION caissier
    // (réellement encaissé), pas au mois de collecte. Exclut EN_ATTENTE_CAISSIER / REJETE.
    tx.remboursementCredit.aggregate({
      where: { agentCollecteurId: userId, statut: "CONFIRME", dateConfirmation: periode },
      _sum: { montant: true },
    }),
    // CA versements packs PAYE de l'agent
    tx.versementPack.aggregate({
      where: { statut: "PAYE", datePaiement: periode, souscription: { userId } },
      _sum: { montant: true },
    }),
  ]);

  return {
    nbVentes:  nbVD + nbCredits + nbPacks,
    montantCA: Number(caComptant._sum.montantPaye ?? 0) + Number(caRecouvrement._sum.montant ?? 0) + Number(caPacks._sum.montant ?? 0),
  };
}

export interface ComposantCommission {
  type: "COMMISSION";
  libelle: string;
  montant: number;
  isRetenue: false;
  ordre: number;
}

/**
 * Commissions automatiques d'un collaborateur pour une période : barèmes liés à
 * son rôle gestionnaire × son activité. Retourne les composants gain.
 */
export async function calculerCommissionsProfil(
  tx: Prisma.TransactionClient,
  gestionnaire: { role: string; memberId: number },
  mois: number,
  annee: number,
): Promise<ComposantCommission[]> {
  const baremes = await tx.baremeCommission.findMany({
    where: { profilCible: gestionnaire.role, actif: true },
  });
  if (baremes.length === 0) return [];

  const act = await getActiviteCommission(tx, gestionnaire.memberId, mois, annee);
  if (act.nbVentes === 0 && act.montantCA === 0) return [];

  const composants: ComposantCommission[] = [];
  for (const b of baremes) {
    const montant = Math.round(calculerMontantCommission(b, act));
    if (montant <= 0) continue;
    composants.push({
      type:      "COMMISSION",
      libelle:   `${b.libelle} — ${act.nbVentes} op.${b.type !== "FIXE" ? `, CA ${fmt(act.montantCA)}` : ""}`,
      montant,
      isRetenue: false,
      ordre:     50,
    });
  }
  return composants;
}
