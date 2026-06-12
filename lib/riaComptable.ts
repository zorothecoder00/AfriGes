import type { Prisma } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Numéros de comptes SYSCOHADA utilisés pour les opérations RIA
// Les écritures sont créées uniquement si le compte existe dans le plan comptable.
export const COMPTES_RIA = {
  BANQUE:              "52",   // Banques — trésorerie
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

/** Cherche un compte par préfixe de numéro. Retourne null si introuvable. */
async function findCompte(tx: TX, prefixe: string): Promise<number | null> {
  const compte = await tx.compteComptable.findFirst({
    where: { numero: { startsWith: prefixe }, actif: true },
    orderBy: { numero: "asc" },
    select: { id: true },
  });
  return compte?.id ?? null;
}

// ── Écriture : Dépôt validé ───────────────────────────────────────────────────
// Dr Banque / Cr Comptes investisseurs RIA
export async function ecritureDépôtRIA(
  tx: TX,
  params: { montant: number; reference: string; investisseurNom: string; userId?: number }
) {
  const [idBanque, idInv] = await Promise.all([
    findCompte(tx, COMPTES.BANQUE),
    findCompte(tx, COMPTES.INVESTISSEURS),
  ]);
  if (!idBanque || !idInv) return; // plan comptable non configuré — on passe silencieusement

  await tx.ecritureComptable.create({
    data: {
      reference: genRef("RIA-DEP"),
      date:      new Date(),
      libelle:   `Dépôt RIA — ${params.investisseurNom} — ${params.reference}`,
      journal:   "BANQUE",
      statut:    "VALIDE",
      userId:    params.userId ?? null,
      lignes: {
        create: [
          { compteId: idBanque, libelle: `Dépôt RIA ${params.reference}`, debit: params.montant, credit: 0 },
          { compteId: idInv,    libelle: `Capital investisseur ${params.investisseurNom}`, debit: 0, credit: params.montant },
        ],
      },
    },
  });
}

// ── Écriture : Retrait payé ───────────────────────────────────────────────────
// Dr Comptes investisseurs RIA / Cr Banque
export async function ecritureRetraitRIA(
  tx: TX,
  params: { montant: number; reference: string; investisseurNom: string; userId?: number }
) {
  const [idBanque, idInv] = await Promise.all([
    findCompte(tx, COMPTES.BANQUE),
    findCompte(tx, COMPTES.INVESTISSEURS),
  ]);
  if (!idBanque || !idInv) return;

  await tx.ecritureComptable.create({
    data: {
      reference: genRef("RIA-RET"),
      date:      new Date(),
      libelle:   `Retrait RIA — ${params.investisseurNom} — ${params.reference}`,
      journal:   "BANQUE",
      statut:    "VALIDE",
      userId:    params.userId ?? null,
      lignes: {
        create: [
          { compteId: idInv,    libelle: `Retrait investisseur ${params.investisseurNom}`, debit: params.montant, credit: 0 },
          { compteId: idBanque, libelle: `Paiement retrait ${params.reference}`, debit: 0, credit: params.montant },
        ],
      },
    },
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
  const [idCharges, idProduits, idInv, idFonds] = await Promise.all([
    findCompte(tx, COMPTES.CHARGES_FINANCIERES),
    findCompte(tx, COMPTES.PRODUITS_FINANCIERS),
    findCompte(tx, COMPTES.INVESTISSEURS),
    findCompte(tx, COMPTES.FOND_SECURITE),
  ]);
  if (!idCharges || !idInv) return;

  const lignes: Prisma.LigneEcritureUncheckedCreateWithoutEcritureInput[] = [
    { compteId: idCharges, libelle: `Bénéfice distribué ${params.portefeuilleRef} ${params.mois}/${params.annee}`, debit: params.montantDistribue, credit: 0 },
    { compteId: idInv,     libelle: `Part investisseur ${params.portefeuilleRef}`, debit: 0, credit: params.montantDistribue },
  ];

  if (params.montantReinvesti > 0 && idProduits) {
    lignes.push(
      { compteId: idInv,      libelle: `Réinvestissement ${params.portefeuilleRef}`, debit: 0, credit: params.montantReinvesti },
      { compteId: idProduits, libelle: `Produit financier réinvesti`,                debit: params.montantReinvesti, credit: 0 }
    );
  }

  if (params.montantSecurite > 0 && idFonds) {
    lignes.push(
      { compteId: idCharges, libelle: `Dotation fonds sécurité ${params.portefeuilleRef}`, debit: params.montantSecurite, credit: 0 },
      { compteId: idFonds,   libelle: `Provision fonds sécurité`,                          debit: 0, credit: params.montantSecurite }
    );
  }

  await tx.ecritureComptable.create({
    data: {
      reference: genRef("RIA-DIST"),
      date:      new Date(),
      libelle:   `Distribution bénéfice RIA — ${params.portefeuilleRef} — ${params.mois}/${params.annee}`,
      journal:   "OD",
      statut:    "VALIDE",
      userId:    params.userId ?? null,
      lignes:    { create: lignes },
    },
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
  const [idCreances, idInv] = await Promise.all([
    findCompte(tx, COMPTES.CREANCES_CLIENTS),
    findCompte(tx, COMPTES.INVESTISSEURS),
  ]);
  if (!idCreances || !idInv) return;

  await tx.ecritureComptable.create({
    data: {
      reference: genRef("RIA-FIN"),
      date:      new Date(),
      libelle:   `Financement RIA — ${params.clientNom} — ${params.reference}`,
      journal:   "OD",
      statut:    "VALIDE",
      userId:    params.userId ?? null,
      lignes: {
        create: [
          { compteId: idCreances, libelle: `Crédit client ${params.clientNom} — ${params.reference}`, debit: params.montant, credit: 0 },
          { compteId: idInv,      libelle: `Fonds investisseur ${params.portefeuilleRef}`,             debit: 0,              credit: params.montant },
        ],
      },
    },
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
  const [idBanque, idCreances] = await Promise.all([
    findCompte(tx, COMPTES.BANQUE),
    findCompte(tx, COMPTES.CREANCES_CLIENTS),
  ]);
  if (!idBanque || !idCreances) return;

  await tx.ecritureComptable.create({
    data: {
      reference: genRef("RIA-REM"),
      date:      new Date(),
      libelle:   `Recouvrement RIA — ${params.clientNom} — ${params.reference}`,
      journal:   "BANQUE",
      statut:    "VALIDE",
      userId:    params.userId ?? null,
      lignes: {
        create: [
          { compteId: idBanque,   libelle: `Encaissement remboursement ${params.reference}`, debit: params.montant, credit: 0 },
          { compteId: idCreances, libelle: `Solde créance ${params.clientNom}`,              debit: 0,              credit: params.montant },
        ],
      },
    },
  });
}
