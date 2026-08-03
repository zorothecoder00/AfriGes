// lib/comptabilite/auxiliaire.ts
//
// Comptes auxiliaires réels (CDC Comptabilité §16-17) : un sous-compte 411xxx
// (client) ou 401xxx (fournisseur) rattaché par FK au tiers concerné, au lieu du
// seul champ texte libre `tiersNom`. Auto-provisionné à la demande — le comptable
// n'a jamais à créer ces comptes à la main.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

const PREFIXE_CLIENT = "411";
const PREFIXE_FOURNISSEUR = "401";

export interface CompteAuxiliaireRef { id: number; numero: string }

async function creerSousCompte(
  tx: TxClient,
  opts: {
    prefixeParent: string;
    suffixe: string;
    libelle: string;
    type: "ACTIF" | "PASSIF";
    sens: "DEBITEUR" | "CREDITEUR";
    clientId?: number;
    fournisseurId?: number;
  },
): Promise<CompteAuxiliaireRef> {
  const numero = `${opts.prefixeParent}${opts.suffixe}`;
  const parent = await tx.compteComptable.findUnique({
    where: { numero: opts.prefixeParent },
    select: { id: true, classe: true },
  });

  return tx.compteComptable.create({
    data: {
      numero,
      libelle: opts.libelle,
      classe: parent?.classe ?? Number(opts.prefixeParent[0]),
      type: opts.type,
      nature: "AUXILIAIRE",
      sens: opts.sens,
      compteParentId: parent?.id ?? null,
      clientId: opts.clientId ?? null,
      fournisseurId: opts.fournisseurId ?? null,
    },
    select: { id: true, numero: true },
  });
}

/** Retourne le compte auxiliaire du client, en le créant s'il n'existe pas encore. */
export async function obtenirOuCreerCompteAuxiliaireClient(tx: TxClient, clientId: number): Promise<CompteAuxiliaireRef> {
  const existing = await tx.compteComptable.findUnique({ where: { clientId }, select: { id: true, numero: true } });
  if (existing) return existing;

  const client = await tx.client.findUnique({ where: { id: clientId }, select: { nom: true, prenom: true } });
  return creerSousCompte(tx, {
    prefixeParent: PREFIXE_CLIENT,
    suffixe: String(clientId).padStart(6, "0"),
    libelle: client ? `${client.prenom} ${client.nom}` : `Client #${clientId}`,
    type: "ACTIF",
    sens: "DEBITEUR",
    clientId,
  });
}

/** Retourne le compte auxiliaire du fournisseur, en le créant s'il n'existe pas encore. */
export async function obtenirOuCreerCompteAuxiliaireFournisseur(tx: TxClient, fournisseurId: number): Promise<CompteAuxiliaireRef> {
  const existing = await tx.compteComptable.findUnique({ where: { fournisseurId }, select: { id: true, numero: true } });
  if (existing) return existing;

  const fournisseur = await tx.fournisseur.findUnique({ where: { id: fournisseurId }, select: { nom: true } });
  return creerSousCompte(tx, {
    prefixeParent: PREFIXE_FOURNISSEUR,
    suffixe: String(fournisseurId).padStart(6, "0"),
    libelle: fournisseur ? fournisseur.nom : `Fournisseur #${fournisseurId}`,
    type: "PASSIF",
    sens: "CREDITEUR",
    fournisseurId,
  });
}

/**
 * Si `numeroBase` est le compte collectif clients (411) ou fournisseurs (401) et
 * qu'un tiers est fourni, retourne (en le créant si besoin) le numéro du sous-compte
 * auxiliaire de ce tiers. Sinon retourne `numeroBase` inchangé — comportement par
 * défaut préservé pour tout appelant qui ne connaît pas encore le tiers exact.
 */
export async function compteAuxiliaireOuDefaut(
  tx: TxClient,
  numeroBase: string,
  tiers?: { clientId?: number | null; fournisseurId?: number | null },
): Promise<string> {
  if (tiers?.clientId != null && numeroBase.startsWith(PREFIXE_CLIENT)) {
    return (await obtenirOuCreerCompteAuxiliaireClient(tx, tiers.clientId)).numero;
  }
  if (tiers?.fournisseurId != null && numeroBase.startsWith(PREFIXE_FOURNISSEUR)) {
    return (await obtenirOuCreerCompteAuxiliaireFournisseur(tx, tiers.fournisseurId)).numero;
  }
  return numeroBase;
}
