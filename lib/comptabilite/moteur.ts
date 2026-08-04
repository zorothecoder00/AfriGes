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
import { Prisma } from "@prisma/client";
import { compteAuxiliaireOuDefaut } from "@/lib/comptabilite/auxiliaire";
import { resoudreTvaVente, decomposerTTC } from "@/lib/comptabilite/tva";

export type TxClient = Prisma.TransactionClient;

export interface LigneMoteur {
  numero: string;
  debit?: number;
  credit?: number;
  libelle?: string;
  isTva?: boolean;
  tauxTva?: number;
  montantTva?: number;
  /** Imputation analytique (CDC §24) — PDV/agence porteur de la ligne, quand l'appelant le connaît. */
  pointDeVenteId?: number | null;
  /** Imputation analytique (CDC §7/§24) — section analytique (activité/projet/département/centre de coût) résolue par la RegleComptable. */
  sectionAnalytiqueId?: number | null;
}

export interface CreerEcritureOpts {
  /** Code d'un journal builtin (voir JOURNAUX_BUILTIN) ou JournalComptable.code (CDC §9). */
  journal: string;
  date: Date;
  libelle: string;
  userId?: number | null;
  lignes: LigneMoteur[];
  reference?: string;
  /** Ignore le verrou de clôture mensuelle (réservé aux écritures de régularisation). */
  ignorerCloture?: boolean;
  /**
   * Statut initial — BROUILLON par défaut (le comptable valide après contrôle).
   * Réservé aux flux où l'opération est déjà entièrement exécutée et certaine
   * (ex. mouvements RIA) : passer "VALIDE" saute le contrôle manuel, à utiliser
   * avec prudence et seulement pour des générateurs déjà validés par ailleurs.
   */
  statut?: "BROUILLON" | "VALIDE";
  /** Multi-société (CDC §50) : omis = société principale implicite (zéro régression). */
  societeId?: number | null;
  /**
   * Multi-devise (CDC §49) : devise de la transaction d'origine, purement
   * informative — les montants de `lignes` sont toujours en devise
   * fonctionnelle. Omis = "XOF"/1 (comportement historique inchangé).
   */
  devise?: string;
  tauxChange?: number;
}

/** Journaux toujours disponibles, câblés dans le code (utilisés partout dans AfriGes) — CDC §9 : les 10 journaux par défaut. */
export const JOURNAUX_BUILTIN = ["CAISSE", "BANQUE", "VENTES", "ACHATS", "OD", "PAIE", "IMMOBILISATIONS", "CLOTURE", "OUVERTURE", "REGULARISATION"] as const;
const BUILTIN_SET = new Set<string>(JOURNAUX_BUILTIN);

const PREFIXES_JOURNAL: Record<string, string> = {
  CAISSE: "CA",
  BANQUE: "BN",
  VENTES: "VT",
  ACHATS: "AC",
  OD: "OD",
  PAIE: "PA",
  IMMOBILISATIONS: "IM",
  CLOTURE: "CL",
  OUVERTURE: "OU",
  REGULARISATION: "RV",
};

/**
 * Un journal est valide s'il est builtin, ou s'il correspond à un
 * JournalComptable actif créé par l'administrateur (CDC §9/§40 — "journal inexistant").
 */
export async function journalValide(tx: TxClient, journal: string): Promise<boolean> {
  if (BUILTIN_SET.has(journal)) return true;
  const j = await tx.journalComptable.findUnique({ where: { code: journal }, select: { actif: true } });
  return !!j?.actif;
}

/**
 * Référence par journal, ex. "VT-2026-000001" (CDC §15 : "VT-2026-000001",
 * "AC-2026-000001"…) — préfixe du journal personnalisé si non-builtin.
 * Séquence propre à chaque journal, remise à zéro chaque année civile (comptée
 * par préfixe de référence, qui encode déjà journal + année) — jamais de
 * doublon puisque `reference` est une colonne unique.
 */
export async function genererReferenceEcriture(tx: TxClient, journal: string): Promise<string> {
  let prefix = PREFIXES_JOURNAL[journal];
  if (!prefix) {
    const j = await tx.journalComptable.findUnique({ where: { code: journal }, select: { prefixe: true } });
    prefix = j?.prefixe ?? journal.slice(0, 2).toUpperCase();
  }
  const annee = new Date().getFullYear();
  const prefixeComplet = `${prefix}-${annee}-`;
  const count = await tx.ecritureComptable.count({ where: { reference: { startsWith: prefixeComplet } } });
  return `${prefixeComplet}${String(count + 1).padStart(6, "0")}`;
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
  if (!(await journalValide(tx, opts.journal))) {
    throw new Error(`Journal "${opts.journal}" inexistant ou inactif`);
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
      statut: opts.statut ?? "BROUILLON",
      userId: opts.userId ?? null,
      societeId: opts.societeId ?? null,
      devise: opts.devise ?? "XOF",
      tauxChange: new Prisma.Decimal(opts.tauxChange ?? 1),
      lignes: {
        create: opts.lignes.map((l) => ({
          compteId: map.get(l.numero)!,
          libelle: l.libelle ?? opts.libelle,
          debit: new Prisma.Decimal(l.debit ?? 0),
          credit: new Prisma.Decimal(l.credit ?? 0),
          isTva: l.isTva ?? false,
          tauxTva: l.tauxTva ?? null,
          montantTva: l.montantTva ?? null,
          pointDeVenteId: l.pointDeVenteId ?? null,
          sectionAnalytiqueId: l.sectionAnalytiqueId ?? null,
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
  /** CategorieProduit.nom (ou Produit.categorie legacy) — CDC §6, mapping automatique par catégorie. */
  categorie?: string | null;
}

export interface ComptesRegle {
  journal: string;
  compteDebitNumero: string;
  compteCreditNumero: string;
  /** CDC §7 — "taxe" : compte de TVA porté par la règle elle-même (indépendant du paramétrage TVA global). */
  compteTvaNumero?: string | null;
  /** CDC §7 — "analytique" / "centre de coût" : imputés sur chaque ligne d'écriture si l'appelant les relaie (LigneMoteur.sectionAnalytiqueId). */
  sectionAnalytiqueId?: number | null;
  centreCoutId?: number | null;
  /** CDC §7 — "devise" : purement informative (CreerEcritureOpts.devise), les montants restent en devise fonctionnelle. */
  devise?: string | null;
}

export function compteTresorerie(modePaiement?: string | null): { numero: string; journal: string } {
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
  // Intérêts/frais de crédit (CDC §8 — "intérêts/frais si applicable → écriture
  // comptable") : avant, noyés dans 701 Ventes avec la marchandise, faussant le
  // compte de résultat (produit financier compté comme chiffre d'affaires
  // commercial). compteDebitNumero n'est jamais utilisé pour ces 2 événements
  // (la contrepartie déjà débitée est 411, cf. ecritureVenteCreditValidee).
  INTERET_CREDIT_CLIENT: () => ({ journal: "VENTES", compteDebitNumero: "411", compteCreditNumero: "771" }),
  FRAIS_CREDIT_CLIENT: () => ({ journal: "VENTES", compteDebitNumero: "411", compteCreditNumero: "758" }),
  // Avoir client (CDC §16) : inverse d'une vente — Dr 701 Ventes (réduit le CA) / Cr 411 Client (réduit la créance).
  AVOIR_CLIENT_EMIS: () => ({ journal: "VENTES", compteDebitNumero: "701", compteCreditNumero: "411" }),
  REMBOURSEMENT_CREDIT_CONFIRME: (ctx) => {
    const tr = compteTresorerie(ctx.modePaiement);
    return { journal: tr.journal, compteDebitNumero: tr.numero, compteCreditNumero: "411" };
  },
  PAIE_VERSEE: (ctx) => {
    const tr = compteTresorerie(ctx.modePaiement);
    return { journal: "PAIE", compteDebitNumero: "661", compteCreditNumero: tr.numero };
  },
  // ctx.modePaiement absent/null = achat à crédit (comportement historique, Dr
  // 311 / Cr 401) ; renseigné (ESPECES/VIREMENT/CHEQUE/MOBILE_MONEY) = achat
  // comptant, crédite directement la trésorerie au lieu du fournisseur.
  RECEPTION_ACHAT_VALIDEE: (ctx) => {
    if (!ctx.modePaiement) return { journal: "ACHATS", compteDebitNumero: "311", compteCreditNumero: "401" };
    const tr = compteTresorerie(ctx.modePaiement);
    return { journal: tr.journal, compteDebitNumero: "311", compteCreditNumero: tr.numero };
  },
  PAIEMENT_FOURNISSEUR: (ctx) => {
    const tr = compteTresorerie(ctx.modePaiement);
    return { journal: tr.journal, compteDebitNumero: "401", compteCreditNumero: tr.numero };
  },
  // Avoir fournisseur (CDC §17) : inverse d'un achat — Dr 401 Fournisseur (réduit la dette) / Cr 601 Achats.
  AVOIR_FOURNISSEUR_RECU: () => ({ journal: "ACHATS", compteDebitNumero: "401", compteCreditNumero: "601" }),
  // Avance/acompte versé à un fournisseur (CDC §17) : Dr 402 / Cr Trésorerie.
  AVANCE_FOURNISSEUR_VERSEE: (ctx) => {
    const tr = compteTresorerie(ctx.modePaiement);
    return { journal: tr.journal, compteDebitNumero: "402", compteCreditNumero: tr.numero };
  },
  // Coût des marchandises vendues (COGS), constaté à la sortie physique du
  // stock : Dr 6031 Variation de stocks / Cr 311 Marchandises.
  SORTIE_STOCK_VENTE: () => ({ journal: "VENTES", compteDebitNumero: "6031", compteCreditNumero: "311" }),
  // Écart d'inventaire physique validé (lib/comptabilite/ecrituresInventaire.ts) :
  // sens (débit/crédit) déterminé à l'appel selon le signe de l'écart — ce couple
  // ne sert que de comptes par défaut (311 Marchandises / 6031 Variation de stocks).
  INVENTAIRE_ECART_VALIDE: () => ({ journal: "OD", compteDebitNumero: "311", compteCreditNumero: "6031" }),
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
  const maintenant = new Date();
  const regles = await tx.regleComptable.findMany({
    where: {
      evenement, actif: true,
      // CDC §7 — "date de validité" : une règle hors de sa fenêtre n'est jamais
      // candidate, exactement comme si elle était inactive.
      OR: [{ dateDebutValidite: null }, { dateDebutValidite: { lte: maintenant } }],
      AND: [{ OR: [{ dateFinValidite: null }, { dateFinValidite: { gte: maintenant } }] }],
    },
    orderBy: { priorite: "desc" },
  });
  for (const r of regles) {
    if (r.conditionProduit && r.conditionProduit !== ctx.produit) continue;
    if (r.conditionFamille && r.conditionFamille !== ctx.famille) continue;
    if (r.conditionCategorie && r.conditionCategorie !== ctx.categorie) continue;
    if (r.conditionModePaiement && r.conditionModePaiement !== (ctx.modePaiement ?? null)) continue;
    return {
      journal: r.journal, compteDebitNumero: r.compteDebitNumero, compteCreditNumero: r.compteCreditNumero,
      compteTvaNumero: r.compteTvaNumero, sectionAnalytiqueId: r.sectionAnalytiqueId, centreCoutId: r.centreCoutId, devise: r.devise,
    };
  }
  return REGLES_PAR_DEFAUT[evenement]?.(ctx) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Points d'intégration (Lot 1) : Crédit, Remboursement, Paie
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vente à crédit validée : Dr Créances client (montant total, y compris
 * intérêts/frais) / Cr Ventes — décomposé en 3 lignes de crédit distinctes
 * quand `montantInteret`/`montantFrais` sont fournis (CDC §8 : "intérêts/frais
 * si applicable → écriture comptable"), plutôt que noyés dans le chiffre
 * d'affaires marchandise. Si `clientId` est fourni, la créance est imputée au
 * sous-compte auxiliaire du client (CDC §16), auto-créé si besoin, plutôt que
 * le seul compte collectif 411. La TVA (CDC §21) ne s'applique qu'à la part
 * marchandise — intérêts et frais de dossier sont des produits financiers hors
 * champ de la TVA collectée sur ventes.
 */
export async function ecritureVenteCreditValidee(
  tx: TxClient,
  params: {
    montant: number; reference: string; clientNom: string; clientId?: number; userId: number; date?: Date; pointDeVenteId?: number | null;
    montantInteret?: number; montantFrais?: number;
  },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "VENTE_CREDIT_VALIDEE");
  if (!regle) return null;
  const compteDebit = await compteAuxiliaireOuDefaut(tx, regle.compteDebitNumero, { clientId: params.clientId });
  const pdv = params.pointDeVenteId ?? null;

  const montantInteret = Math.max(0, params.montantInteret ?? 0);
  const montantFrais = Math.max(0, params.montantFrais ?? 0);
  const montantMarchandise = Math.max(0, params.montant - montantInteret - montantFrais);

  const lignes: LigneMoteur[] = [{ numero: compteDebit, debit: params.montant, libelle: `Créance ${params.clientNom}`, pointDeVenteId: pdv }];

  // TVA (CDC §21) : si une taxe TVA est active et applicable aux ventes, la
  // part marchandise (TTC) est décomposée HT/TVA ; sinon comportement inchangé.
  const tva = await resoudreTvaVente(tx);
  if (tva && montantMarchandise > 0) {
    const { montantHT, montantTVA } = decomposerTTC(montantMarchandise, tva.taux);
    lignes.push(
      { numero: regle.compteCreditNumero, credit: montantHT, libelle: `Vente crédit ${params.reference}`, pointDeVenteId: pdv },
      { numero: tva.compteCollecteNumero, credit: montantTVA, libelle: `TVA collectée ${params.reference}`, isTva: true, tauxTva: tva.taux, montantTva: montantTVA, pointDeVenteId: pdv },
    );
  } else if (montantMarchandise > 0) {
    lignes.push({ numero: regle.compteCreditNumero, credit: montantMarchandise, libelle: `Vente crédit ${params.reference}`, pointDeVenteId: pdv });
  }

  if (montantInteret > 0) {
    const regleInteret = await resoudreRegleComptable(tx, "INTERET_CREDIT_CLIENT");
    if (regleInteret) lignes.push({ numero: regleInteret.compteCreditNumero, credit: montantInteret, libelle: `Intérêts crédit ${params.reference}`, pointDeVenteId: pdv });
  }
  if (montantFrais > 0) {
    const regleFrais = await resoudreRegleComptable(tx, "FRAIS_CREDIT_CLIENT");
    if (regleFrais) lignes.push({ numero: regleFrais.compteCreditNumero, credit: montantFrais, libelle: `Frais de dossier crédit ${params.reference}`, pointDeVenteId: pdv });
  }

  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Vente à crédit — ${params.clientNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-CRD-${params.reference}`,
    lignes,
  });
}

/**
 * Avoir client (CDC §16) : Dr Ventes / Cr Créances client — inverse d'une
 * vente, imputé au sous-compte auxiliaire du client si `clientId` est fourni.
 * Pas de décomposition TVA (simplification assumée : les avoirs de ce module
 * portent sur des corrections commerciales, la TVA collectée initiale n'est
 * pas retraitée ligne à ligne ici).
 */
export async function ecritureAvoirClient(
  tx: TxClient,
  params: { montant: number; reference: string; clientNom: string; clientId?: number; userId: number; date?: Date },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "AVOIR_CLIENT_EMIS");
  if (!regle) return null;
  const compteCredit = await compteAuxiliaireOuDefaut(tx, regle.compteCreditNumero, { clientId: params.clientId });
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Avoir client — ${params.clientNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-AVR-${params.reference}`,
    lignes: [
      { numero: regle.compteDebitNumero, debit: params.montant, libelle: `Avoir ${params.reference}` },
      { numero: compteCredit, credit: params.montant, libelle: `Avoir ${params.reference}` },
    ],
  });
}

/**
 * Remboursement de crédit confirmé (encaissement cash/banque) : Dr Trésorerie /
 * Cr Créances client — imputée au sous-compte auxiliaire du client si `clientId`
 * est fourni, symétriquement à `ecritureVenteCreditValidee`.
 */
export async function ecritureRemboursementCreditConfirme(
  tx: TxClient,
  params: {
    montant: number;
    reference: string;
    clientNom: string;
    clientId?: number;
    modePaiement?: string | null;
    userId: number;
    date?: Date;
    pointDeVenteId?: number | null;
  },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "REMBOURSEMENT_CREDIT_CONFIRME", { modePaiement: params.modePaiement });
  if (!regle) return null;
  const compteCredit = await compteAuxiliaireOuDefaut(tx, regle.compteCreditNumero, { clientId: params.clientId });
  const pdv = params.pointDeVenteId ?? null;
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Remboursement crédit — ${params.clientNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-RBT-${params.reference}`,
    lignes: [
      { numero: regle.compteDebitNumero, debit: params.montant, libelle: `Encaissement ${params.reference}`, pointDeVenteId: pdv },
      { numero: compteCredit, credit: params.montant, libelle: `Solde créance ${params.clientNom}`, pointDeVenteId: pdv },
    ],
  });
}

/**
 * Paiement fournisseur (règlement d'un achat à crédit) : Dr Fournisseurs /
 * Cr Trésorerie — imputé au sous-compte auxiliaire du fournisseur si
 * `fournisseurId` est fourni, symétriquement à `ecritureRemboursementCreditConfirme`.
 */
export async function ecripturePaiementFournisseur(
  tx: TxClient,
  params: {
    montant: number;
    reference: string;
    fournisseurNom: string;
    fournisseurId?: number;
    modePaiement?: string | null;
    userId: number;
    date?: Date;
    pointDeVenteId?: number | null;
  },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "PAIEMENT_FOURNISSEUR", { modePaiement: params.modePaiement });
  if (!regle) return null;
  const compteDebit = await compteAuxiliaireOuDefaut(tx, regle.compteDebitNumero, { fournisseurId: params.fournisseurId });
  const pdv = params.pointDeVenteId ?? null;
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Paiement fournisseur — ${params.fournisseurNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-PAF-${params.reference}`,
    lignes: [
      { numero: compteDebit, debit: params.montant, libelle: `Solde dette ${params.fournisseurNom}`, pointDeVenteId: pdv },
      { numero: regle.compteCreditNumero, credit: params.montant, libelle: `Décaissement ${params.reference}`, pointDeVenteId: pdv },
    ],
  });
}

/**
 * Avoir fournisseur (CDC §17) : Dr Fournisseurs / Cr Achats — inverse d'un
 * achat, imputé au sous-compte auxiliaire du fournisseur si `fournisseurId`
 * est fourni.
 */
export async function ecritureAvoirFournisseur(
  tx: TxClient,
  params: { montant: number; reference: string; fournisseurNom: string; fournisseurId?: number; userId: number; date?: Date },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "AVOIR_FOURNISSEUR_RECU");
  if (!regle) return null;
  const compteDebit = await compteAuxiliaireOuDefaut(tx, regle.compteDebitNumero, { fournisseurId: params.fournisseurId });
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Avoir fournisseur — ${params.fournisseurNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-AVF-${params.reference}`,
    lignes: [
      { numero: compteDebit, debit: params.montant, libelle: `Avoir ${params.reference}` },
      { numero: regle.compteCreditNumero, credit: params.montant, libelle: `Avoir ${params.reference}` },
    ],
  });
}

/** Avance/acompte versé à un fournisseur (CDC §17) : Dr 402 / Cr Trésorerie. */
export async function ecritureAvanceFournisseur(
  tx: TxClient,
  params: { montant: number; reference: string; fournisseurNom: string; modePaiement?: string | null; userId: number; date?: Date },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "AVANCE_FOURNISSEUR_VERSEE", { modePaiement: params.modePaiement });
  if (!regle) return null;
  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Avance fournisseur — ${params.fournisseurNom} — ${params.reference}`,
    userId: params.userId,
    reference: `SYNC-AVF2-${params.reference}`,
    lignes: [
      { numero: regle.compteDebitNumero, debit: params.montant, libelle: `Avance ${params.reference}` },
      { numero: regle.compteCreditNumero, credit: params.montant, libelle: `Avance ${params.reference}` },
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

/**
 * Sortie de stock / coût des marchandises vendues (COGS) pour une ligne du
 * module « Crédits clients » (CreditClient/LigneCreditClient — distinct de
 * VenteDirecte, voir lib/ecritureVenteServer.ts::creerEcritureCogsVenteDirecte
 * pour l'équivalent côté vente directe). Constatée à la livraison physique
 * (statut EN_ATTENTE→LIVRE), jamais à la validation du crédit qui ne fait que
 * réserver le stock. Coût = `Produit.prixAchat` (ou du substitut si la ligne a
 * été substituée) × quantité ; ligne sans coût connu ignorée, jamais fabriqué.
 */
export async function creerEcritureCogsLigneCreditClient(
  tx: TxClient,
  ligneCreditClientId: number,
  userId: number,
): Promise<void> {
  const ligne = await tx.ligneCreditClient.findUnique({
    where: { id: ligneCreditClientId },
    select: {
      quantite: true,
      produitId: true,
      produitSubstitutId: true,
      credit: { select: { reference: true, pointDeVenteId: true } },
    },
  });
  if (!ligne) return;

  const produitId = ligne.produitSubstitutId ?? ligne.produitId;
  if (produitId == null) return;

  const produit = await tx.produit.findUnique({
    where: { id: produitId },
    select: { prixAchat: true, categorie: true, categorieProduit: { select: { nom: true } } },
  });
  if (!produit || produit.prixAchat == null) return;

  const coutTotal = ligne.quantite * Number(produit.prixAchat);
  if (coutTotal <= 0) return;

  // CDC §6 — mapping automatique du compte stock/variation de stock par
  // catégorie de produit (ex: Riz → comptes spécifiques si paramétré) ; sans
  // règle personnalisée pour cette catégorie, retombe sur 6031/311 (inchangé).
  const categorie = produit.categorieProduit?.nom ?? produit.categorie ?? null;
  const regle = await resoudreRegleComptable(tx, "SORTIE_STOCK_VENTE", { categorie });
  if (!regle) return;

  await creerEcriture(tx, {
    reference: `SYNC-COGS-LCC-${ligneCreditClientId}`,
    date: new Date(),
    journal: regle.journal,
    libelle: `Sortie de stock — ${ligne.credit.reference}`,
    userId,
    lignes: [
      { numero: regle.compteDebitNumero, debit: coutTotal, libelle: `COGS ${ligne.credit.reference}`, pointDeVenteId: ligne.credit.pointDeVenteId },
      { numero: regle.compteCreditNumero, credit: coutTotal, libelle: `COGS ${ligne.credit.reference}`, pointDeVenteId: ligne.credit.pointDeVenteId },
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
      societeId: original.societeId,
      devise: original.devise,
      tauxChange: original.tauxChange,
      lignes: {
        create: original.lignes.map((l) => ({
          compteId: l.compteId,
          libelle: `Contrepassation — ${l.libelle}`,
          debit: l.credit,
          credit: l.debit,
          isTva: l.isTva,
          tauxTva: l.tauxTva,
          montantTva: l.montantTva,
          pointDeVenteId: l.pointDeVenteId,
        })),
      },
    },
    select: { id: true },
  });
  return ecriture.id;
}
