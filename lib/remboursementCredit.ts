import { Prisma, StatutCredit, StatutEcheanceCredit, TypePaiement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";

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
  // Infos crédit (utiles quand un client a plusieurs crédits)
  montantTotal: number;
  montantRembourse: number;
  montantJournalier: number; // sert au calcul du montant attendu multi-jours
  tauxPaye: number;      // % remboursé (0–100)
  dateDebut: string;     // ISO — date de début du crédit (mois + jour) pour identifier le crédit
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
  agentId?: number | null,
): Promise<CreditAEncaisser[]> {
  // Filtre optionnel par agent de terrain affecté au client, intersecté avec le
  // périmètre du rôle (ex. PDV du RVC/caissier) sur la même clé `client`.
  const clientWhere: Prisma.ClientWhereInput = {
    ...(where.client && typeof where.client === "object" ? (where.client as Prisma.ClientWhereInput) : {}),
    ...(agentId ? { agentTerrainId: agentId } : {}),
  };
  const credits = await prisma.creditClient.findMany({
    where: {
      ...where,
      statut: { in: [StatutCredit.ACTIF, StatutCredit.EN_RETARD] },
      ...(Object.keys(clientWhere).length ? { client: clientWhere } : {}),
    },
    select: {
      id: true, reference: true, soldeRestant: true, dureeJours: true,
      montantTotal: true, montantRembourse: true, montantJournalier: true, dateDebut: true,
      client: { select: { id: true, nom: true, prenom: true, telephone: true } },
      echeances: {
        where: { statut: { not: StatutEcheanceCredit.PAYE } },
        orderBy: { numeroEcheance: "asc" },
        take: 1,
        select: { numeroEcheance: true, montantDu: true, montantPaye: true },
      },
    },
    orderBy: [{ client: { nom: "asc" } }, { dateDebut: "asc" }],
  });

  return credits.map((c) => {
    const ech = c.echeances[0];
    const total = Number(c.montantTotal);
    const rembourse = Number(c.montantRembourse);
    return {
      clientId:     c.client.id,
      clientNom:    c.client.nom,
      clientPrenom: c.client.prenom,
      telephone:    c.client.telephone,
      creditId:     c.id,
      reference:    c.reference,
      soldeRestant: Number(c.soldeRestant),
      dureeJours:   c.dureeJours,
      montantTotal: total,
      montantRembourse: rembourse,
      montantJournalier: Number(c.montantJournalier),
      tauxPaye:     total > 0 ? Math.round((rembourse / total) * 100) : 0,
      dateDebut:    c.dateDebut.toISOString(),
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

// ── Modification d'un remboursement déjà enregistré (correction d'erreur) ────────

/**
 * Réimpute intégralement l'échéancier d'un crédit à partir d'un total remboursé
 * donné, quel que soit son statut courant, puis recalcule montantRembourse,
 * soldeRestant et statut (SOLDE / EN_RETARD / ACTIF). Utilisé lors de la
 * correction d'un montant de remboursement (un crédit SOLDE peut se rouvrir).
 */
async function regenererEcheancesEtStatut(
  tx: TX,
  credit: { id: number; montantTotal: Prisma.Decimal | number; dureeJours: number; dateDebut: Date },
  totalRembourse: number,
): Promise<void> {
  const montantTotal      = Number(credit.montantTotal);
  const duree             = credit.dureeJours;
  const montantJournalier = Number((montantTotal / duree).toFixed(2));
  const residuel          = Number((montantTotal - montantJournalier * duree).toFixed(2));
  const soldeRestant      = Math.max(0, Number((montantTotal - totalRembourse).toFixed(2)));
  const debut             = new Date(credit.dateDebut);
  const now               = new Date();

  await tx.echeanceCredit.deleteMany({ where: { creditId: credit.id } });

  let budget = totalRembourse;
  let resteEnRetard = false;
  const echData = Array.from({ length: duree }, (_, idx) => {
    const i = idx + 1;
    const d = new Date(debut);
    d.setDate(d.getDate() + idx);
    const montantDu = i === duree ? Number((montantJournalier + residuel).toFixed(2)) : montantJournalier;
    const paye = Math.min(budget, montantDu);
    budget = Number((budget - paye).toFixed(2));
    const statut = paye >= montantDu
      ? StatutEcheanceCredit.PAYE
      : paye > 0 ? StatutEcheanceCredit.PARTIEL : StatutEcheanceCredit.EN_ATTENTE;
    if (paye < montantDu && d < now) resteEnRetard = true;
    return { creditId: credit.id, numeroEcheance: i, dateEcheance: d, montantDu, montantPaye: paye, statut };
  });
  await tx.echeanceCredit.createMany({ data: echData });

  const nouveauStatut = soldeRestant <= 0
    ? StatutCredit.SOLDE
    : resteEnRetard ? StatutCredit.EN_RETARD : StatutCredit.ACTIF;

  await tx.creditClient.update({
    where: { id: credit.id },
    data:  { montantRembourse: totalRembourse, soldeRestant, statut: nouveauStatut },
  });
}

/** Annule l'effet RIA d'un remboursement (réversion encours + capital portefeuille). */
async function reverserEffetRIA(tx: TX, remboursementCreditId: number, refCredit: string): Promise<void> {
  const parts = await tx.remboursementRIA.findMany({
    where:   { remboursementCreditId },
    include: { financement: { select: { id: true, portefeuilleId: true, encours: true, statut: true, reference: true } } },
  });
  for (const rr of parts) {
    const part = Number(rr.montant);
    const fin  = rr.financement;
    const newEncours = Number((Number(fin.encours) + part).toFixed(2));
    await tx.operationFinancementRIA.update({
      where: { id: fin.id },
      data: {
        montantRembourse: { decrement: part },
        encours:          newEncours,
        statut:           fin.statut === "REMBOURSE" && newEncours > 0 ? "ACTIF" : fin.statut,
      },
    });
    await tx.portefeuilleRIA.update({
      where: { id: fin.portefeuilleId },
      data: {
        capitalEngage:     { increment: part },
        capitalRecouvre:   { decrement: part },
        capitalDisponible: { decrement: part },
      },
    });
    await tx.mouvementFondsRIA.create({
      data: {
        type: "AJUSTEMENT", montant: part, sens: "DEBIT",
        description: `Annulation recouvrement (correction remboursement) — crédit ${refCredit}`,
        reference: fin.reference, portefeuilleId: fin.portefeuilleId, financementId: fin.id,
      },
    });
    await tx.remboursementRIA.delete({ where: { id: rr.id } });
  }
}

/** Applique le recouvrement RIA proportionnel d'un montant (identique à l'enregistrement). */
async function appliquerEffetRIA(
  tx: TX, creditId: number, refCredit: string, remboursementCreditId: number, montant: number,
): Promise<void> {
  const fins = await tx.operationFinancementRIA.findMany({
    where: { creditClientId: creditId, statut: { in: ["ACTIF", "EN_RETARD"] } },
  });
  const totalEncours = fins.reduce((s, f) => s + Number(f.encours), 0);
  for (const fin of fins) {
    if (Number(fin.encours) <= 0) continue;
    const part = Number(Math.min(montant * (totalEncours > 0 ? Number(fin.encours) / totalEncours : 0), Number(fin.encours)).toFixed(2));
    if (part <= 0) continue;
    const newEncours = Number(Math.max(0, Number(fin.encours) - part).toFixed(2));
    await tx.remboursementRIA.create({ data: { financementId: fin.id, montant: part, remboursementCreditId } });
    await tx.operationFinancementRIA.update({
      where: { id: fin.id },
      data:  { montantRembourse: { increment: part }, encours: newEncours, statut: newEncours <= 0 ? "REMBOURSE" : fin.statut },
    });
    await tx.portefeuilleRIA.update({
      where: { id: fin.portefeuilleId },
      data:  { capitalEngage: { decrement: part }, capitalRecouvre: { increment: part }, capitalDisponible: { increment: part } },
    });
    await tx.mouvementFondsRIA.create({
      data: {
        type: "REMBOURSEMENT_CLIENT", montant: part, sens: "CREDIT",
        description: `Recouvrement (correction remboursement) — crédit ${refCredit}`,
        reference: fin.reference, portefeuilleId: fin.portefeuilleId, financementId: fin.id,
      },
    });
  }
}

export interface ParamsModification {
  remboursementId:   number;
  /** Nouveau montant. `undefined` = inchangé. */
  nouveauMontant?:   number | null;
  /** Nouvelle date de collecte (ISO). `undefined` = inchangé. */
  dateCollecte?:     string | null;
  /** Nouveau N° de jour. `undefined` = inchangé. */
  numeroJour?:       number | null;
  /** Nouvel agent collecteur. `undefined` = inchangé. */
  agentCollecteurId?: number | null;
  /** Nouvelle observation. `undefined` = inchangé. */
  observation?:      string | null;
  userId:            number;
  /** Portée facultative : le crédit doit correspondre (scoping PDV caissier). */
  pdvId?:            number | null;
}

export type ResultatModification =
  | { ok: true; remboursementId: number; montantEffectif: number; recalculFinancier: boolean }
  | { ok: false; error: string; status: number };

/**
 * Modifie un remboursement de crédit déjà enregistré (correction d'erreur de
 * saisie). Gère le montant ET les champs non financiers (date, N° jour, agent,
 * notes), dans une seule transaction.
 *
 * - Remboursement EN_ATTENTE_CAISSIER : aucun effet financier appliqué → simple
 *   mise à jour des champs.
 * - Remboursement CONFIRME : recalcul financier complet — réimputation de
 *   l'échéancier, montantRembourse / solde / statut du crédit, soldeActuel du
 *   client, et réversion + réapplication du recouvrement RIA des financements liés.
 *
 * Le montant est plafonné pour que le total remboursé ne dépasse pas le montant
 * total du crédit.
 */
export async function modifierRemboursementCredit(p: ParamsModification): Promise<ResultatModification> {
  return prisma.$transaction(async (tx) => {
    const remb = await tx.remboursementCredit.findUnique({
      where: { id: p.remboursementId },
      include: {
        credit: {
          select: {
            id: true, clientId: true, reference: true, statut: true,
            montantTotal: true, montantRembourse: true, soldeRestant: true,
            dureeJours: true, dateDebut: true,
            client: { select: { pointDeVenteId: true } },
          },
        },
      },
    });
    if (!remb) return { ok: false as const, error: "Remboursement introuvable", status: 404 };

    const credit = remb.credit;
    if (p.pdvId != null && credit.client.pointDeVenteId !== p.pdvId) {
      return { ok: false as const, error: "Ce remboursement n'appartient pas à votre point de vente", status: 403 };
    }
    if (remb.statut === "REJETE") {
      return { ok: false as const, error: "Un remboursement rejeté ne peut pas être modifié", status: 422 };
    }
    if (credit.statut === StatutCredit.ANNULE || credit.statut === StatutCredit.REJETE) {
      return { ok: false as const, error: "Le crédit associé n'est pas modifiable", status: 422 };
    }

    // ── Champs non financiers ─────────────────────────────────────────────────
    const data: Prisma.RemboursementCreditUpdateInput = {};
    if (p.dateCollecte !== undefined) {
      const d = parseDateCollecte(p.dateCollecte);
      if (d) data.dateRemboursement = d;
    }
    if (p.numeroJour !== undefined) {
      const nj = p.numeroJour ?? null;
      const err = validerNumeroJour(nj, credit.dureeJours);
      if (err) return { ok: false as const, error: err, status: 400 };
      data.numeroJour = nj;
      data.montantAttendu = await montantAttenduDuJour(tx, credit.id, nj);
    }
    if (p.agentCollecteurId !== undefined) {
      data.agentCollecteur = p.agentCollecteurId
        ? { connect: { id: p.agentCollecteurId } }
        : { disconnect: true };
    }
    if (p.observation !== undefined) data.notes = p.observation || null;

    // ── Montant ───────────────────────────────────────────────────────────────
    const oldMontant = Number(remb.montant);
    let montantEffectif = oldMontant;
    let recalcul = false;

    const veutChangerMontant =
      p.nouveauMontant !== undefined && p.nouveauMontant !== null && Number(p.nouveauMontant) !== oldMontant;

    if (veutChangerMontant) {
      const requested = Number(p.nouveauMontant);
      if (requested <= 0) return { ok: false as const, error: "Le montant doit être positif", status: 400 };

      if (remb.statut === "EN_ATTENTE_CAISSIER") {
        // Aucun effet financier encore appliqué → simple correction du montant.
        montantEffectif = requested;
        data.montant = montantEffectif;
      } else {
        // CONFIRME → recalcul financier complet.
        recalcul = true;

        // 1. Annuler l'effet RIA de ce remboursement.
        await reverserEffetRIA(tx, remb.id, credit.reference);

        // 2. Plafonner : total remboursé ≤ montant total du crédit.
        const agg = await tx.remboursementCredit.aggregate({
          where:  { creditId: credit.id, statut: "CONFIRME", id: { not: remb.id } },
          _sum:   { montant: true },
        });
        const otherSum   = Number(agg._sum.montant ?? 0);
        const maxForThis = Math.max(0, Number((Number(credit.montantTotal) - otherSum).toFixed(2)));
        montantEffectif  = Number(Math.min(requested, maxForThis).toFixed(2));
        data.montant     = montantEffectif;

        const newTotal = Number((otherSum + montantEffectif).toFixed(2));

        // 3. Réimputer l'échéancier + recalculer crédit.
        await regenererEcheancesEtStatut(tx, credit, newTotal);

        // 4. Ajuster le solde du client (delta).
        const deltaClient = Number((oldMontant - montantEffectif).toFixed(2));
        if (deltaClient !== 0) {
          await tx.client.update({
            where: { id: credit.clientId },
            data:  { soldeActuel: { increment: deltaClient } },
          });
        }

        // 5. Réappliquer le recouvrement RIA avec le nouveau montant.
        await appliquerEffetRIA(tx, credit.id, credit.reference, remb.id, montantEffectif);
      }
    }

    if (Object.keys(data).length > 0) {
      await tx.remboursementCredit.update({ where: { id: remb.id }, data });
    }

    await auditLog(tx, p.userId, "MODIFICATION_REMBOURSEMENT_CREDIT", "RemboursementCredit", remb.id, {
      avant: { montant: oldMontant },
      apres: { montant: montantEffectif },
      recalculFinancier: recalcul,
    });

    return { ok: true as const, remboursementId: remb.id, montantEffectif, recalculFinancier: recalcul };
  });
}
