// lib/comptabilite/moteur.ts
//
// Moteur comptable central (CDC Comptabilité §7/§81) : point d'entrée unique pour
// transformer un événement métier en écriture SYSCOHADA équilibrée. Avant ce
// fichier, chaque module (RIA, achats, compte courant, sync-journals) dupliquait
// la même logique (résolution de compte par numéro, génération de référence,
// création de l'écriture) avec ses propres numéros câblés en dur.
//
// Principe : le code métier ne connaît jamais un numéro de compte. Il déclare un
// `evenement` (+ contexte) à `resoudreRegleComptable`, qui cherche une
// `RegleComptable` active paramétrée par le comptable, et ne retombe sur des
// valeurs par défaut (REGLES_PAR_DEFAUT ci-dessous) que si aucune règle
// personnalisée n'existe — donc zéro régression et entièrement reconfigurable
// sans redéploiement.
import { Prisma, type TypeJournalComptable } from "@prisma/client";

export type TxClient = Prisma.TransactionClient;

export interface LigneMoteur {
  numero: string;
  debit?: number;
  credit?: number;
  libelle?: string;
  isTva?: boolean;
  tauxTva?: number;
  montantTva?: number;
}

export interface CreerEcritureOpts {
  journal: TypeJournalComptable;
  date: Date;
  libelle: string;
  userId?: number | null;
  lignes: LigneMoteur[];
  reference?: string;
  /** Ignore le verrou de clôture mensuelle (réservé aux écritures de régularisation). */
  ignorerCloture?: boolean;
}

const PREFIXES_JOURNAL: Record<TypeJournalComptable, string> = {
  CAISSE: "CA",
  BANQUE: "BN",
  VENTES: "VT",
  ACHATS: "AC",
  OD: "OD",
  PAIE: "PA",
};

/** Référence par journal, ex. "VT-202607-00001" (CDC §15). */
export async function genererReferenceEcriture(tx: TxClient, journal: TypeJournalComptable): Promise<string> {
  const prefix = PREFIXES_JOURNAL[journal] ?? journal.slice(0, 2).toUpperCase();
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await tx.ecritureComptable.count();
  return `${prefix}-${ym}-${String(count + 1).padStart(5, "0")}`;
}

async function periodeClôturée(tx: TxClient, date: Date): Promise<boolean> {
  const cloture = await tx.clotureComptable.findUnique({
    where: { annee_mois: { annee: date.getFullYear(), mois: date.getMonth() + 1 } },
    select: { id: true },
  });
  return !!cloture;
}

/**
 * Crée une écriture comptable (statut BROUILLON) équilibrée à partir de numéros
 * de compte, résolus en base. Idempotent par référence : un second appel avec la
 * même référence renvoie l'écriture déjà créée sans doublon.
 *
 * Retourne `null` (sans exception) si un compte du plan comptable est introuvable
 * ou si la période est clôturée : l'opération métier appelante n'est jamais
 * bloquée, l'écriture pourra être régularisée manuellement par le comptable.
 */
export async function creerEcriture(tx: TxClient, opts: CreerEcritureOpts): Promise<number | null> {
  const totalDebit = opts.lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = opts.lignes.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Écriture non équilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`);
  }

  if (!opts.ignorerCloture && (await periodeClôturée(tx, opts.date))) return null;

  const numeros = [...new Set(opts.lignes.map((l) => l.numero))];
  const comptes = await tx.compteComptable.findMany({
    where: { numero: { in: numeros }, actif: true },
    select: { id: true, numero: true },
  });
  const map = new Map(comptes.map((c) => [c.numero, c.id]));
  if (opts.lignes.some((l) => !map.has(l.numero))) return null;

  const reference = opts.reference ?? (await genererReferenceEcriture(tx, opts.journal));
  const existing = await tx.ecritureComptable.findUnique({ where: { reference }, select: { id: true } });
  if (existing) return existing.id;

  const ecriture = await tx.ecritureComptable.create({
    data: {
      reference,
      date: opts.date,
      libelle: opts.libelle,
      journal: opts.journal,
      statut: "BROUILLON",
      userId: opts.userId ?? null,
      lignes: {
        create: opts.lignes.map((l) => ({
          compteId: map.get(l.numero)!,
          libelle: l.libelle ?? opts.libelle,
          debit: new Prisma.Decimal(l.debit ?? 0),
          credit: new Prisma.Decimal(l.credit ?? 0),
          isTva: l.isTva ?? false,
          tauxTva: l.tauxTva ?? null,
          montantTva: l.montantTva ?? null,
        })),
      },
    },
    select: { id: true },
  });
  return ecriture.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Moteur de règles (CDC §7)
// ─────────────────────────────────────────────────────────────────────────────

export interface ContexteEvenement {
  modePaiement?: string | null;
  produit?: string | null;
  famille?: string | null;
}

export interface ComptesRegle {
  journal: TypeJournalComptable;
  compteDebitNumero: string;
  compteCreditNumero: string;
}

function compteTresorerie(modePaiement?: string | null): { numero: string; journal: TypeJournalComptable } {
  const m = (modePaiement ?? "").toUpperCase();
  if (["VIREMENT", "CHEQUE", "MOBILE_MONEY"].includes(m)) return { numero: "521", journal: "BANQUE" };
  return { numero: "571", journal: "CAISSE" };
}

// Règles par défaut : reproduisent exactement les numéros de comptes déjà
// utilisés historiquement ailleurs dans le projet (sync-journals,
// ecritureAchatServer). Le comptable peut les surcharger en créant une
// RegleComptable active pour le même `evenement` (priorité DB > défaut code).
const REGLES_PAR_DEFAUT: Record<string, (ctx: ContexteEvenement) => ComptesRegle> = {
  VENTE_CREDIT_VALIDEE: () => ({ journal: "VENTES", compteDebitNumero: "411", compteCreditNumero: "701" }),
  REMBOURSEMENT_CREDIT_CONFIRME: (ctx) => {
    const tr = compteTresorerie(ctx.modePaiement);
    return { journal: tr.journal, compteDebitNumero: tr.numero, compteCreditNumero: "411" };
  },
  PAIE_VERSEE: (ctx) => {
    const tr = compteTresorerie(ctx.modePaiement);
    return { journal: "PAIE", compteDebitNumero: "661", compteCreditNumero: tr.numero };
  },
};

/**
 * Résout les comptes à utiliser pour un événement donné : d'abord une
 * RegleComptable active en base (la plus prioritaire dont les conditions
 * correspondent au contexte), sinon la règle par défaut du code.
 */
export async function resoudreRegleComptable(
  tx: TxClient,
  evenement: string,
  ctx: ContexteEvenement = {},
): Promise<ComptesRegle | null> {
  const regles = await tx.regleComptable.findMany({
    where: { evenement, actif: true },
    orderBy: { priorite: "desc" },
  });
  for (const r of regles) {
    if (r.conditionProduit && r.conditionProduit !== ctx.produit) continue;
    if (r.conditionFamille && r.conditionFamille !== ctx.famille) continue;
    if (r.conditionModePaiement && r.conditionModePaiement !== (ctx.modePaiement ?? null)) continue;
    return { journal: r.journal, compteDebitNumero: r.compteDebitNumero, compteCreditNumero: r.compteCreditNumero };
  }
  return REGLES_PAR_DEFAUT[evenement]?.(ctx) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Points d'intégration (Lot 1) : Crédit, Remboursement, Paie
// ─────────────────────────────────────────────────────────────────────────────

/** Vente à crédit validée : Dr Créances client / Cr Ventes. */
export async function ecritureVenteCreditValidee(
  tx: TxClient,
  params: { montant: number; reference: string; clientNom: string; userId: number; date?: Date },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "VENTE_CREDIT_VALIDEE");
  if (!regle) return null;
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Vente à crédit — ${params.clientNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-CRD-${params.reference}`,
    lignes: [
      { numero: regle.compteDebitNumero, debit: params.montant, libelle: `Créance ${params.clientNom}` },
      { numero: regle.compteCreditNumero, credit: params.montant, libelle: `Vente crédit ${params.reference}` },
    ],
  });
}

/** Remboursement de crédit confirmé (encaissement cash/banque) : Dr Trésorerie / Cr Créances client. */
export async function ecritureRemboursementCreditConfirme(
  tx: TxClient,
  params: {
    montant: number;
    reference: string;
    clientNom: string;
    modePaiement?: string | null;
    userId: number;
    date?: Date;
  },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "REMBOURSEMENT_CREDIT_CONFIRME", { modePaiement: params.modePaiement });
  if (!regle) return null;
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Remboursement crédit — ${params.clientNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-RBT-${params.reference}`,
    lignes: [
      { numero: regle.compteDebitNumero, debit: params.montant, libelle: `Encaissement ${params.reference}` },
      { numero: regle.compteCreditNumero, credit: params.montant, libelle: `Solde créance ${params.clientNom}` },
    ],
  });
}

/** Paie versée (mise en paiement effective) : Dr Rémunérations / Cr Trésorerie. */
export async function ecripturePaieVersee(
  tx: TxClient,
  params: {
    montant: number;
    reference: string;
    profilNom: string;
    modePaiement?: string | null;
    userId: number;
    date?: Date;
  },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "PAIE_VERSEE", { modePaiement: params.modePaiement });
  if (!regle) return null;
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Paie versée — ${params.profilNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-PAIE-${params.reference}`,
    lignes: [
      { numero: regle.compteDebitNumero, debit: params.montant, libelle: `Rémunération ${params.profilNom}` },
      { numero: regle.compteCreditNumero, credit: params.montant, libelle: `Paiement ${params.reference}` },
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrepassation (CDC §13)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère l'écriture inverse d'une écriture validée/clôturée (débit/crédit
 * permutés), sans jamais modifier ni supprimer l'originale — son historique
 * reste intact. La nouvelle écriture est créée directement VALIDE : son
 * équilibre est garanti par construction (exacte symétrie de l'originale).
 */
export async function contrepasserEcriture(tx: TxClient, ecritureId: number, userId: number): Promise<number> {
  const original = await tx.ecritureComptable.findUnique({
    where: { id: ecritureId },
    include: { lignes: true },
  });
  if (!original) throw new Error("ÉCRITURE_INTROUVABLE");
  if (original.statut !== "VALIDE" && original.statut !== "CLOTURE") {
    throw new Error("SEULES_LES_ECRITURES_VALIDEES_PEUVENT_ETRE_CONTREPASSEES");
  }

  const reference = `CP-${original.reference}`;
  const dejaContrepassee = await tx.ecritureComptable.findUnique({ where: { reference }, select: { id: true } });
  if (dejaContrepassee) throw new Error("DEJA_CONTREPASSEE");

  const ecriture = await tx.ecritureComptable.create({
    data: {
      reference,
      date: new Date(),
      libelle: `Contrepassation — ${original.libelle}`,
      journal: original.journal,
      statut: "VALIDE",
      userId,
      lignes: {
        create: original.lignes.map((l) => ({
          compteId: l.compteId,
          libelle: `Contrepassation — ${l.libelle}`,
          debit: l.credit,
          credit: l.debit,
          isTva: l.isTva,
          tauxTva: l.tauxTva,
          montantTva: l.montantTva,
        })),
      },
    },
    select: { id: true },
  });
  return ecriture.id;
}
