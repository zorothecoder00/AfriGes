import { Prisma, StatutCredit, StatutEcheanceCredit, TypePaiement } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Valide le N° de jour d'un encaissement journalier (1..dureeJours du crédit).
 * Retourne un message d'erreur ou null si valide / absent (champ optionnel).
 */
export function validerNumeroJour(numeroJour: number | null | undefined, dureeJours: number): string | null {
  if (numeroJour === null || numeroJour === undefined) return null;
  if (!Number.isInteger(numeroJour) || numeroJour < 1 || numeroJour > dureeJours) {
    return `N° de jour invalide (doit être compris entre 1 et ${dureeJours}).`;
  }
  return null;
}

/**
 * Montant attendu = montant restant de l'échéance correspondant au N° de jour
 * (calcul automatique, autorité serveur). Retourne null si pas de N° de jour ou
 * d'échéance correspondante.
 */
export async function montantAttenduDuJour(
  tx: TX,
  creditId: number,
  numeroJour: number | null | undefined,
): Promise<number | null> {
  if (numeroJour === null || numeroJour === undefined) return null;
  const echeance = await tx.echeanceCredit.findFirst({
    where: { creditId, numeroEcheance: numeroJour },
    select: { montantDu: true, montantPaye: true },
  });
  if (!echeance) return null;
  return Math.max(0, Number(echeance.montantDu) - Number(echeance.montantPaye));
}

/**
 * Parse une date de collecte fournie par le client (ISO ou yyyy-mm-dd).
 * Retourne `undefined` si absente/invalide → laisse le défaut Prisma (now()).
 */
export function parseDateCollecte(value: unknown): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── Liste des crédits à encaisser (mode saisie rapide / tournée) ─────────────────
export interface CreditAEncaisser {
  clientId: number;
  clientNom: string;
  clientPrenom: string;
  telephone: string;
  creditId: number;
  reference: string;
  soldeRestant: number;
  dureeJours: number;
  // Prochaine échéance non soldée (défaut du « Jour » et de l'« Attendu »)
  numeroJour: number | null;
  montantAttendu: number;
}

/**
 * Charge les crédits ACTIF/EN_RETARD d'un périmètre (where Prisma) et calcule
 * pour chacun la prochaine échéance non soldée → défaut Jour + Attendu.
 */
export async function chargerCreditsAEncaisser(
  where: Prisma.CreditClientWhereInput,
): Promise<CreditAEncaisser[]> {
  const credits = await prisma.creditClient.findMany({
    where: { ...where, statut: { in: [StatutCredit.ACTIF, StatutCredit.EN_RETARD] } },
    select: {
      id: true, reference: true, soldeRestant: true, dureeJours: true,
      client: { select: { id: true, nom: true, prenom: true, telephone: true } },
      echeances: {
        where: { statut: { not: StatutEcheanceCredit.PAYE } },
        orderBy: { numeroEcheance: "asc" },
        take: 1,
        select: { numeroEcheance: true, montantDu: true, montantPaye: true },
      },
    },
    orderBy: { dateDebut: "asc" },
  });

  return credits.map((c) => {
    const ech = c.echeances[0];
    return {
      clientId:     c.client.id,
      clientNom:    c.client.nom,
      clientPrenom: c.client.prenom,
      telephone:    c.client.telephone,
      creditId:     c.id,
      reference:    c.reference,
      soldeRestant: Number(c.soldeRestant),
      dureeJours:   c.dureeJours,
      numeroJour:   ech?.numeroEcheance ?? null,
      montantAttendu: ech ? Math.max(0, Number(ech.montantDu) - Number(ech.montantPaye)) : 0,
    };
  });
}

// ── Enregistrement unitaire (réutilisé en saisie rapide / batch) ────────────────
export interface ParamsEnregistrement {
  creditId: number;
  montant: number;
  numeroJour: number | null;
  observation?: string | null;
  modePaiement?: TypePaiement;
  enregistreParId: number;   // « secrétaire » : qui saisit
  agentCollecteurId: number; // qui a collecté
  dateCollecte?: Date;
  /** true = effets financiers immédiats (CONFIRME) ; false = EN_ATTENTE_CAISSIER. */
  confirmer: boolean;
}

export type ResultatEnregistrement =
  | { ok: true; remboursementId: number; montantEffectif: number; estSolde: boolean }
  | { ok: false; error: string };

/**
 * Enregistre un remboursement de crédit dans une transaction existante.
 * - confirmer=false : crée la ligne EN_ATTENTE_CAISSIER (aucun effet financier).
 * - confirmer=true  : impute les échéances, met à jour le crédit, le solde client
 *   et cascade le recouvrement vers les financements RIA liés.
 * Le N° de jour doit avoir été validé par l'appelant.
 */
export async function enregistrerRemboursementCredit(
  tx: TX,
  p: ParamsEnregistrement,
): Promise<ResultatEnregistrement> {
  const credit = await tx.creditClient.findUnique({
    where: { id: p.creditId },
    select: { id: true, reference: true, clientId: true, statut: true, soldeRestant: true, montantRembourse: true, tauxPenalite: true },
  });
  if (!credit) return { ok: false, error: "Crédit introuvable" };
  if (credit.statut !== StatutCredit.ACTIF && credit.statut !== StatutCredit.EN_RETARD) {
    return { ok: false, error: `Crédit ${credit.reference} non remboursable (${String(credit.statut).toLowerCase()})` };
  }

  const montantAttendu  = await montantAttenduDuJour(tx, p.creditId, p.numeroJour);
  const montantEffectif = Math.min(Number(p.montant), Number(credit.soldeRestant));
  const baseData = {
    creditId:          p.creditId,
    montant:           montantEffectif,
    modePaiement:      p.modePaiement ?? TypePaiement.ESPECES,
    notes:             p.observation || null,
    enregistreParId:   p.enregistreParId,
    agentCollecteurId: p.agentCollecteurId,
    numeroJour:        p.numeroJour,
    montantAttendu,
    dateRemboursement: p.dateCollecte ?? new Date(),
  };

  // ── Non confirmé : simple enregistrement en attente caissier ──────────────────
  if (!p.confirmer) {
    const r = await tx.remboursementCredit.create({ data: { ...baseData, statut: "EN_ATTENTE_CAISSIER" } });
    return { ok: true, remboursementId: r.id, montantEffectif, estSolde: false };
  }

  // ── Confirmé : effets financiers immédiats ────────────────────────────────────
  const now = new Date();
  const echeances = await tx.echeanceCredit.findMany({
    where: { creditId: p.creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] } },
    orderBy: { dateEcheance: "asc" },
  });

  let budget = montantEffectif;
  for (const ec of echeances) {
    if (budget <= 0) break;
    const restant = Number(ec.montantDu) - Number(ec.montantPaye);
    let penalite = Number(ec.penalite ?? 0);
    if (ec.dateEcheance < now && Number(credit.tauxPenalite) > 0) {
      const jours = Math.max(0, Math.floor((now.getTime() - ec.dateEcheance.getTime()) / 86400000));
      penalite = Number((Number(ec.montantDu) * (Number(credit.tauxPenalite) / 100) * jours).toFixed(2));
    }
    if (budget >= restant) {
      await tx.echeanceCredit.update({ where: { id: ec.id }, data: { montantPaye: Number(ec.montantDu), statut: StatutEcheanceCredit.PAYE, penalite } });
      budget -= restant;
    } else {
      await tx.echeanceCredit.update({ where: { id: ec.id }, data: { montantPaye: { increment: budget }, statut: StatutEcheanceCredit.PARTIEL, penalite } });
      budget = 0;
    }
  }

  const newSolde     = Math.max(0, Number(credit.soldeRestant) - montantEffectif);
  const newRembourse = Number(credit.montantRembourse) + montantEffectif;
  let newStatut: StatutCredit;
  if (newSolde <= 0) {
    newStatut = StatutCredit.SOLDE;
    await tx.echeanceCredit.updateMany({
      where: { creditId: p.creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] } },
      data:  { statut: StatutEcheanceCredit.PAYE },
    });
  } else {
    const retard = await tx.echeanceCredit.findFirst({
      where: { creditId: p.creditId, statut: { in: [StatutEcheanceCredit.EN_ATTENTE, StatutEcheanceCredit.PARTIEL] }, dateEcheance: { lt: now } },
    });
    newStatut = retard ? StatutCredit.EN_RETARD : StatutCredit.ACTIF;
  }

  await tx.creditClient.update({ where: { id: p.creditId }, data: { montantRembourse: newRembourse, soldeRestant: newSolde, statut: newStatut } });
  await tx.client.update({ where: { id: credit.clientId }, data: { soldeActuel: { decrement: montantEffectif } } });

  const remboursement = await tx.remboursementCredit.create({ data: { ...baseData, statut: "CONFIRME" } });

  // ── Cascade RIA : recouvrement proportionnel à l'encours des financements ─────
  const financementsRIA = await tx.operationFinancementRIA.findMany({
    where: { creditClientId: p.creditId, statut: { in: ["ACTIF", "EN_RETARD"] } },
  });
  const totalEncoursRIA = financementsRIA.reduce((s, f) => s + Number(f.encours), 0);
  for (const fin of financementsRIA) {
    if (Number(fin.encours) <= 0) continue;
    const part = Number(Math.min(montantEffectif * (totalEncoursRIA > 0 ? Number(fin.encours) / totalEncoursRIA : 0), Number(fin.encours)).toFixed(2));
    if (part <= 0) continue;
    const newEncours = Number(Math.max(0, Number(fin.encours) - part).toFixed(2));
    await tx.remboursementRIA.create({ data: { financementId: fin.id, montant: part, remboursementCreditId: remboursement.id } });
    await tx.operationFinancementRIA.update({
      where: { id: fin.id },
      data: { montantRembourse: { increment: part }, encours: newEncours, statut: newEncours <= 0 ? "REMBOURSE" : fin.statut },
    });
    await tx.portefeuilleRIA.update({
      where: { id: fin.portefeuilleId },
      data: { capitalEngage: { decrement: part }, capitalRecouvre: { increment: part }, capitalDisponible: { increment: part } },
    });
    await tx.mouvementFondsRIA.create({
      data: { type: "REMBOURSEMENT_CLIENT", montant: part, sens: "CREDIT", description: `Remboursement (saisie rapide) — crédit ${credit.reference}`, reference: fin.reference, portefeuilleId: fin.portefeuilleId, financementId: fin.id },
    });
  }

  return { ok: true, remboursementId: remboursement.id, montantEffectif, estSolde: newStatut === StatutCredit.SOLDE };
}

// ── Traitement par lot (mode saisie rapide) ─────────────────────────────────────
export interface LigneBatch {
  creditId: number;
  numeroJour: number | null;
  montant: number;
  observation?: string | null;
}

export interface ResultatBatch {
  enregistres: number;
  ignores: number;       // lignes à 0 / absentes
  montantTotal: number;
  erreurs: { creditId: number; error: string }[];
}

/**
 * Enregistre plusieurs remboursements en une seule transaction. Les lignes à
 * montant ≤ 0 (client absent) sont ignorées. Une ligne en erreur est rapportée
 * sans faire échouer les autres. Chaque crédit est revalidé contre `scopeWhere`.
 */
export async function traiterBatchRemboursement(params: {
  lignes: LigneBatch[];
  scopeWhere: Prisma.CreditClientWhereInput;
  enregistreParId: number;
  agentCollecteurId: number;
  confirmer: boolean;
  dateCollecte?: Date;
}): Promise<ResultatBatch> {
  const res: ResultatBatch = { enregistres: 0, ignores: 0, montantTotal: 0, erreurs: [] };
  const aTraiter = params.lignes.filter((l) => Number(l.montant) > 0);
  res.ignores = params.lignes.length - aTraiter.length;
  if (aTraiter.length === 0) return res;

  await prisma.$transaction(async (tx) => {
    for (const l of aTraiter) {
      // Revalidation du périmètre (le crédit doit appartenir au scope du rôle)
      const credit = await tx.creditClient.findFirst({
        where: { id: l.creditId, ...params.scopeWhere },
        select: { id: true, dureeJours: true },
      });
      if (!credit) { res.erreurs.push({ creditId: l.creditId, error: "Crédit hors périmètre" }); continue; }

      const errJour = validerNumeroJour(l.numeroJour, credit.dureeJours);
      if (errJour) { res.erreurs.push({ creditId: l.creditId, error: errJour }); continue; }

      const out = await enregistrerRemboursementCredit(tx, {
        creditId:          l.creditId,
        montant:           Number(l.montant),
        numeroJour:        l.numeroJour,
        observation:       l.observation,
        enregistreParId:   params.enregistreParId,
        agentCollecteurId: params.agentCollecteurId,
        dateCollecte:      params.dateCollecte,
        confirmer:         params.confirmer,
      });
      if (out.ok) { res.enregistres += 1; res.montantTotal += out.montantEffectif; }
      else res.erreurs.push({ creditId: l.creditId, error: out.error });
    }
  });

  return res;
}
