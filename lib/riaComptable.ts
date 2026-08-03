import type { Prisma } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Numéros de comptes SYSCOHADA utilisés pour les opérations RIA
// Les écritures sont créées uniquement si le compte existe dans le plan comptable
// (creerEcriture retourne null silencieusement dans ce cas — comportement
// identique à avant la migration vers le moteur central).
//
// Note migration : avant le moteur central, ces numéros étaient résolus par
// préfixe (`startsWith`) — "52" matchait "521". Le moteur central résout par
// numéro EXACT ; "BANQUE" est donc explicité en "521" (le compte que le préfixe
// résolvait déjà en pratique) pour préserver le comportement à l'identique.
export const COMPTES_RIA = {
  BANQUE:              "521",  // Banques comptes courants — trésorerie
  INVESTISSEURS:       "1672", // Comptes courants associés RIA
  CREANCES_CLIENTS:    "416",  // Créances clients RIA (financement crédit)
  PRODUITS_FINANCIERS: "776",  // Revenus des participations
  CHARGES_FINANCIERES: "676",  // Charges d'intérêts / distributions
  FOND_SECURITE:       "165",  // Provisions financières
};

// Alias interne pour compatibilité
const COMPTES = COMPTES_RIA;

// Préfixe commun à toutes les écritures RIA — utile pour filtrer le journal
export const RIA_REF_PREFIX = "RIA-";

function genRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
}

// ── Écriture : Dépôt validé ───────────────────────────────────────────────────
// Dr Banque / Cr Comptes investisseurs RIA
export async function ecritureDépôtRIA(
  tx: TX,
  params: { montant: number; reference: string; investisseurNom: string; userId?: number }
) {
  await creerEcriture(tx, {
    journal: "BANQUE",
    date: new Date(),
    libelle: `Dépôt RIA — ${params.investisseurNom} — ${params.reference}`,
    userId: params.userId,
    reference: genRef("RIA-DEP"),
    statut: "VALIDE",
    lignes: [
      { numero: COMPTES.BANQUE, debit: params.montant, libelle: `Dépôt RIA ${params.reference}` },
      { numero: COMPTES.INVESTISSEURS, credit: params.montant, libelle: `Capital investisseur ${params.investisseurNom}` },
    ],
  });
}

// ── Écriture : Retrait payé ───────────────────────────────────────────────────
// Dr Comptes investisseurs RIA / Cr Banque
export async function ecritureRetraitRIA(
  tx: TX,
  params: { montant: number; reference: string; investisseurNom: string; userId?: number }
) {
  await creerEcriture(tx, {
    journal: "BANQUE",
    date: new Date(),
    libelle: `Retrait RIA — ${params.investisseurNom} — ${params.reference}`,
    userId: params.userId,
    reference: genRef("RIA-RET"),
    statut: "VALIDE",
    lignes: [
      { numero: COMPTES.INVESTISSEURS, debit: params.montant, libelle: `Retrait investisseur ${params.investisseurNom}` },
      { numero: COMPTES.BANQUE, credit: params.montant, libelle: `Paiement retrait ${params.reference}` },
    ],
  });
}

// ── Écriture : Distribution bénéfice ─────────────────────────────────────────
// Dr Charges financières (distribué) / Cr Comptes investisseurs
// Dr Fonds sécurité    (provision)   / Cr Provisions
export async function ecritureDistributionRIA(
  tx: TX,
  params: {
    montantDistribue: number;
    montantReinvesti: number;
    montantSecurite: number;
    mois: number;
    annee: number;
    portefeuilleRef: string;
    userId?: number;
  }
) {
  const lignes: { numero: string; debit?: number; credit?: number; libelle: string }[] = [
    { numero: COMPTES.CHARGES_FINANCIERES, debit: params.montantDistribue, libelle: `Bénéfice distribué ${params.portefeuilleRef} ${params.mois}/${params.annee}` },
    { numero: COMPTES.INVESTISSEURS, credit: params.montantDistribue, libelle: `Part investisseur ${params.portefeuilleRef}` },
  ];

  if (params.montantReinvesti > 0) {
    lignes.push(
      { numero: COMPTES.INVESTISSEURS, credit: params.montantReinvesti, libelle: `Réinvestissement ${params.portefeuilleRef}` },
      { numero: COMPTES.PRODUITS_FINANCIERS, debit: params.montantReinvesti, libelle: `Produit financier réinvesti` },
    );
  }

  if (params.montantSecurite > 0) {
    lignes.push(
      { numero: COMPTES.CHARGES_FINANCIERES, debit: params.montantSecurite, libelle: `Dotation fonds sécurité ${params.portefeuilleRef}` },
      { numero: COMPTES.FOND_SECURITE, credit: params.montantSecurite, libelle: `Provision fonds sécurité` },
    );
  }

  await creerEcriture(tx, {
    journal: "OD",
    date: new Date(),
    libelle: `Distribution bénéfice RIA — ${params.portefeuilleRef} — ${params.mois}/${params.annee}`,
    userId: params.userId,
    reference: genRef("RIA-DIST"),
    statut: "VALIDE",
    lignes,
  });
}

// ── Écriture : Financement client (déblocage crédit) ─────────────────────────
// Dr Créances Clients RIA / Cr Fonds Investisseur
export async function ecritureFinancementRIA(
  tx: TX,
  params: {
    montant: number;
    reference: string;
    clientNom: string;
    portefeuilleRef: string;
    userId?: number;
  }
) {
  await creerEcriture(tx, {
    journal: "OD",
    date: new Date(),
    libelle: `Financement RIA — ${params.clientNom} — ${params.reference}`,
    userId: params.userId,
    reference: genRef("RIA-FIN"),
    statut: "VALIDE",
    lignes: [
      { numero: COMPTES.CREANCES_CLIENTS, debit: params.montant, libelle: `Crédit client ${params.clientNom} — ${params.reference}` },
      { numero: COMPTES.INVESTISSEURS, credit: params.montant, libelle: `Fonds investisseur ${params.portefeuilleRef}` },
    ],
  });
}

// ── Écriture : Recouvrement (remboursement client) ────────────────────────────
// Dr Trésorerie / Cr Créances Clients RIA
export async function ecritureRecouvrementRIA(
  tx: TX,
  params: {
    montant: number;
    reference: string;
    clientNom: string;
    userId?: number;
  }
) {
  await creerEcriture(tx, {
    journal: "BANQUE",
    date: new Date(),
    libelle: `Recouvrement RIA — ${params.clientNom} — ${params.reference}`,
    userId: params.userId,
    reference: genRef("RIA-REM"),
    statut: "VALIDE",
    lignes: [
      { numero: COMPTES.BANQUE, debit: params.montant, libelle: `Encaissement remboursement ${params.reference}` },
      { numero: COMPTES.CREANCES_CLIENTS, credit: params.montant, libelle: `Solde créance ${params.clientNom}` },
    ],
  });
}
