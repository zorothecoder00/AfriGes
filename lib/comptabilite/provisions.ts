// lib/comptabilite/provisions.ts
//
// Provisions pour risques/charges et dépréciations (stock/client/immobilisation) —
// écart CDC Comptabilité comblé : jusqu'ici seuls les comptes 191/198/291/391/491
// existaient dans le plan comptable, sans aucun moteur pour doter ou reprendre une
// provision. Toute écriture générée ici passe par le moteur central
// (lib/comptabilite/moteur.ts) — mêmes garanties (équilibre, idempotence, clôture).
import type { Prisma, TypeProvision, StatutProvision } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

async function resoudreCompte(tx: TxClient, numero: string): Promise<number> {
  const compte = await tx.compteComptable.findUnique({ where: { numero }, select: { id: true } });
  if (!compte) throw new Error(`COMPTE_INTROUVABLE:${numero}`);
  return compte.id;
}

export interface CreerProvisionOpts {
  libelle: string;
  type: "PROVISION_RISQUE_CHARGE" | "DEPRECIATION_STOCK" | "DEPRECIATION_CLIENT" | "DEPRECIATION_IMMOBILISATION";
  compteProvisionNumero: string; // 19x/29x/39x/49x
  compteDotationNumero: string; // 68x
  compteRepriseNumero: string; // 78x/79x
  montantInitial: number;
  motif: string;
  dateConstitution: Date;
  clientId?: number | null;
  fournisseurId?: number | null;
  immobilisationId?: number | null;
  societeId?: number | null;
}

/** Crée le registre d'une provision (statut ACTIVE) — ne génère aucune écriture : la dotation initiale se fait via `doterProvision`. */
export async function creerProvision(tx: TxClient, opts: CreerProvisionOpts, userId: number) {
  const [compteProvisionId, compteDotationId, compteRepriseId] = await Promise.all([
    resoudreCompte(tx, opts.compteProvisionNumero),
    resoudreCompte(tx, opts.compteDotationNumero),
    resoudreCompte(tx, opts.compteRepriseNumero),
  ]);
  return tx.provisionDepreciation.create({
    data: {
      libelle: opts.libelle,
      type: opts.type,
      compteProvisionId,
      compteDotationId,
      compteRepriseId,
      montantInitial: opts.montantInitial,
      montantActuel: 0,
      motif: opts.motif,
      dateConstitution: opts.dateConstitution,
      clientId: opts.clientId ?? null,
      fournisseurId: opts.fournisseurId ?? null,
      immobilisationId: opts.immobilisationId ?? null,
      societeId: opts.societeId ?? null,
      creePar: userId,
    },
  });
}

/** Dotation (constitution ou renforcement) : Dr compte de dotation (68x) / Cr compte de provision. */
export async function doterProvision(
  tx: TxClient,
  provisionId: number,
  montant: number,
  date: Date,
  userId: number,
): Promise<{ ecritureId: number | null }> {
  if (montant <= 0) throw new Error("MONTANT_INVALIDE");
  const provision = await tx.provisionDepreciation.findUnique({
    where: { id: provisionId },
    include: { compteProvision: { select: { numero: true } }, compteDotation: { select: { numero: true } } },
  });
  if (!provision) throw new Error("PROVISION_INTROUVABLE");
  if (provision.statut === "SOLDEE") throw new Error("PROVISION_SOLDEE");

  const ecritureId = await creerEcriture(tx, {
    journal: "OD",
    date,
    libelle: `Dotation provision — ${provision.libelle}`,
    userId,
    reference: `SYNC-PROV-DOT-${provisionId}-${date.getTime()}`,
    lignes: [
      { numero: provision.compteDotation.numero, debit: montant, libelle: `Dotation ${provision.libelle}` },
      { numero: provision.compteProvision.numero, credit: montant, libelle: `Dotation ${provision.libelle}` },
    ],
  });

  const montantActuel = Number(provision.montantActuel) + montant;
  await tx.provisionDepreciation.update({
    where: { id: provisionId },
    data: { montantActuel, statut: "ACTIVE" },
  });
  await tx.mouvementProvision.create({
    data: { provisionId, type: "DOTATION", montant, date, ecritureId, userId },
  });

  return { ecritureId };
}

/** Reprise (partielle ou totale) : Dr compte de provision / Cr compte de reprise (78x/79x). */
export async function reprendreProvision(
  tx: TxClient,
  provisionId: number,
  montant: number,
  date: Date,
  userId: number,
): Promise<{ ecritureId: number | null }> {
  if (montant <= 0) throw new Error("MONTANT_INVALIDE");
  const provision = await tx.provisionDepreciation.findUnique({
    where: { id: provisionId },
    include: { compteProvision: { select: { numero: true } }, compteReprise: { select: { numero: true } } },
  });
  if (!provision) throw new Error("PROVISION_INTROUVABLE");
  if (montant > Number(provision.montantActuel) + 0.01) throw new Error("MONTANT_SUPERIEUR_AU_SOLDE");

  const ecritureId = await creerEcriture(tx, {
    journal: "OD",
    date,
    libelle: `Reprise provision — ${provision.libelle}`,
    userId,
    reference: `SYNC-PROV-REP-${provisionId}-${date.getTime()}`,
    lignes: [
      { numero: provision.compteProvision.numero, debit: montant, libelle: `Reprise ${provision.libelle}` },
      { numero: provision.compteReprise.numero, credit: montant, libelle: `Reprise ${provision.libelle}` },
    ],
  });

  const montantActuel = Math.max(0, Number(provision.montantActuel) - montant);
  await tx.provisionDepreciation.update({
    where: { id: provisionId },
    data: { montantActuel, statut: montantActuel <= 0.01 ? "SOLDEE" : "PARTIELLEMENT_REPRISE" },
  });
  await tx.mouvementProvision.create({
    data: { provisionId, type: "REPRISE", montant, date, ecritureId, userId },
  });

  return { ecritureId };
}

export interface FiltresProvisions {
  type?: TypeProvision;
  statut?: StatutProvision;
}

export async function listerProvisions(tx: TxClient, filtres: FiltresProvisions = {}) {
  return tx.provisionDepreciation.findMany({
    where: {
      ...(filtres.type ? { type: filtres.type } : {}),
      ...(filtres.statut ? { statut: filtres.statut } : {}),
    },
    include: {
      compteProvision: { select: { numero: true, libelle: true } },
      client: { select: { nom: true, prenom: true } },
      fournisseur: { select: { nom: true } },
      immobilisation: { select: { designation: true } },
      mouvements: { orderBy: { date: "desc" } },
    },
    orderBy: { dateConstitution: "desc" },
  });
}
