import type { Prisma } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Numéros de comptes SYSCOHADA utilisés pour les opérations RIA
// Les écritures sont créées uniquement si le compte existe dans le plan comptable.
const COMPTES = {
  BANQUE:              "52",   // Banques — dépôts/retraits
  INVESTISSEURS:       "1672", // Comptes courants associés RIA (ou 467)
  PRODUITS_FINANCIERS: "776",  // Revenus des participations
  CHARGES_FINANCIERES: "676",  // Charges d'intérêts
  FOND_SECURITE:       "165",  // Provisions financières
};

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
