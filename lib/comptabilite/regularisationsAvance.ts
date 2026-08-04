// lib/comptabilite/regularisationsAvance.ts
//
// Charges et produits constatés d'avance (CCA/PCA) — écart CDC Comptabilité comblé :
// aucun modèle ni logique n'existait pour étaler dans le temps la part hors-exercice
// d'une charge/produit. Principe SYSCOHADA : la part concernant l'exercice suivant
// est immédiatement sortie du compte de charge/produit (6x/7x) vers 4786 (CCA) ou
// 4787 (PCA) — 476/477 sont déjà pris par les écarts de conversion actif/passif
// dans le plan comptable livré — puis réimputée mois par mois via ses échéances.
// Toute écriture générée ici passe par le moteur central (lib/comptabilite/moteur.ts).
import type { Prisma, TypeRegularisation, StatutRegularisation } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

async function resoudreCompte(tx: TxClient, numero: string): Promise<number> {
  const compte = await tx.compteComptable.findUnique({ where: { numero }, select: { id: true } });
  if (!compte) throw new Error(`COMPTE_INTROUVABLE:${numero}`);
  return compte.id;
}

function listePeriodesMensuelles(dateDebut: Date, dateFin: Date): string[] {
  const periodes: string[] = [];
  const curseur = new Date(dateDebut.getFullYear(), dateDebut.getMonth(), 1);
  const fin = new Date(dateFin.getFullYear(), dateFin.getMonth(), 1);
  while (curseur <= fin) {
    periodes.push(`${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, "0")}`);
    curseur.setMonth(curseur.getMonth() + 1);
  }
  return periodes;
}

export interface CreerRegularisationOpts {
  libelle: string;
  type: "CHARGE_CONSTATEE_AVANCE" | "PRODUIT_CONSTATE_AVANCE";
  compteChargeOuProduitNumero: string; // 6x (CCA) ou 7x (PCA)
  compteRegularisationNumero: string; // 4786 (CCA) ou 4787 (PCA)
  montantTotal: number;
  dateDebut: Date;
  dateFin: Date;
  societeId?: number | null;
}

/**
 * Constate immédiatement la part à étaler (écriture de sortie du 6x/7x vers 476/477),
 * puis génère l'échéancier mensuel (réparti linéairement entre dateDebut et dateFin).
 */
export async function creerRegularisation(tx: TxClient, opts: CreerRegularisationOpts, userId: number) {
  if (opts.montantTotal <= 0) throw new Error("MONTANT_INVALIDE");
  if (opts.dateFin < opts.dateDebut) throw new Error("PERIODE_INVALIDE");

  const [compteChargeOuProduitId, compteRegularisationId] = await Promise.all([
    resoudreCompte(tx, opts.compteChargeOuProduitNumero),
    resoudreCompte(tx, opts.compteRegularisationNumero),
  ]);

  const regularisation = await tx.regularisationAvance.create({
    data: {
      libelle: opts.libelle,
      type: opts.type,
      compteChargeOuProduitId,
      compteRegularisationId,
      montantTotal: opts.montantTotal,
      dateDebut: opts.dateDebut,
      dateFin: opts.dateFin,
      societeId: opts.societeId ?? null,
      creePar: userId,
    },
  });

  const estCCA = opts.type === "CHARGE_CONSTATEE_AVANCE";
  const ecritureConstatationId = await creerEcriture(tx, {
    journal: "REGULARISATION",
    date: opts.dateDebut,
    libelle: `Constatation ${estCCA ? "CCA" : "PCA"} — ${opts.libelle}`,
    userId,
    reference: `SYNC-REGUL-${regularisation.id}`,
    lignes: estCCA
      ? [
          { numero: opts.compteRegularisationNumero, debit: opts.montantTotal, libelle: opts.libelle },
          { numero: opts.compteChargeOuProduitNumero, credit: opts.montantTotal, libelle: opts.libelle },
        ]
      : [
          { numero: opts.compteChargeOuProduitNumero, debit: opts.montantTotal, libelle: opts.libelle },
          { numero: opts.compteRegularisationNumero, credit: opts.montantTotal, libelle: opts.libelle },
        ],
  });

  const periodes = listePeriodesMensuelles(opts.dateDebut, opts.dateFin);
  const montantParMois = Math.round((opts.montantTotal / periodes.length) * 100) / 100;
  const ecarts = Math.round((opts.montantTotal - montantParMois * periodes.length) * 100) / 100;

  await tx.echeanceRegularisation.createMany({
    data: periodes.map((periode, idx) => ({
      regularisationId: regularisation.id,
      periode,
      // Le dernier mois absorbe l'écart d'arrondi pour retomber exactement sur montantTotal.
      montant: idx === periodes.length - 1 ? montantParMois + ecarts : montantParMois,
    })),
  });

  await tx.regularisationAvance.update({ where: { id: regularisation.id }, data: { ecritureConstatationId } });

  return regularisation;
}

/**
 * Comptabilise l'échéance d'un mois donné : réimpute la part correspondante du
 * 476/477 vers le compte de charge/produit d'origine (écriture inverse de la
 * constatation, pour ce seul mois).
 */
export async function comptabiliserEcheance(tx: TxClient, echeanceId: number, userId: number): Promise<{ ecritureId: number | null }> {
  const echeance = await tx.echeanceRegularisation.findUnique({
    where: { id: echeanceId },
    include: {
      regularisation: {
        include: {
          compteChargeOuProduit: { select: { numero: true } },
          compteRegularisation: { select: { numero: true } },
        },
      },
    },
  });
  if (!echeance) throw new Error("ECHEANCE_INTROUVABLE");
  if (echeance.comptabilise) throw new Error("ECHEANCE_DEJA_COMPTABILISEE");

  const regul = echeance.regularisation;
  const estCCA = regul.type === "CHARGE_CONSTATEE_AVANCE";
  const montant = Number(echeance.montant);

  const ecritureId = await creerEcriture(tx, {
    journal: "REGULARISATION",
    date: new Date(`${echeance.periode}-01`),
    libelle: `Échéance ${estCCA ? "CCA" : "PCA"} ${echeance.periode} — ${regul.libelle}`,
    userId,
    reference: `SYNC-REGUL-ECH-${echeanceId}`,
    lignes: estCCA
      ? [
          { numero: regul.compteChargeOuProduit.numero, debit: montant, libelle: regul.libelle },
          { numero: regul.compteRegularisation.numero, credit: montant, libelle: regul.libelle },
        ]
      : [
          { numero: regul.compteRegularisation.numero, debit: montant, libelle: regul.libelle },
          { numero: regul.compteChargeOuProduit.numero, credit: montant, libelle: regul.libelle },
        ],
  });

  await tx.echeanceRegularisation.update({ where: { id: echeanceId }, data: { comptabilise: true, ecritureId } });

  const restantes = await tx.echeanceRegularisation.count({ where: { regularisationId: regul.id, comptabilise: false } });
  if (restantes === 0) {
    await tx.regularisationAvance.update({ where: { id: regul.id }, data: { statut: "SOLDEE" } });
  }

  return { ecritureId };
}

/** Comptabilise en lot toutes les échéances non traitées d'une période (appelable depuis l'assistant de clôture). */
export async function genererEcheancesDuMois(tx: TxClient, annee: number, mois: number, userId: number): Promise<{ comptabilisees: number }> {
  const periode = `${annee}-${String(mois).padStart(2, "0")}`;
  const echeances = await tx.echeanceRegularisation.findMany({ where: { periode, comptabilise: false }, select: { id: true } });
  let comptabilisees = 0;
  for (const e of echeances) {
    await comptabiliserEcheance(tx, e.id, userId);
    comptabilisees++;
  }
  return { comptabilisees };
}

export async function listerRegularisations(tx: TxClient, filtres: { type?: TypeRegularisation; statut?: StatutRegularisation } = {}) {
  return tx.regularisationAvance.findMany({
    where: {
      ...(filtres.type ? { type: filtres.type } : {}),
      ...(filtres.statut ? { statut: filtres.statut } : {}),
    },
    include: { echeances: { orderBy: { periode: "asc" } } },
    orderBy: { dateDebut: "desc" },
  });
}
