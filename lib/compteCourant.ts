// lib/compteCourant.ts
// Helpers du module Compte Courant client :
//  - génération du numéro de compte (12 chiffres, commence par « 12 »)
//  - calcul de la clé RIB (contrôle type modulo 97)
//  - format du RIB complet affiché
//  - chargement du paramétrage (singleton)

import { prisma } from "@/lib/prisma";
import { Prisma, type TypeJournalComptable } from "@prisma/client";

export type TxClient = Prisma.TransactionClient;

/** Préfixe imposé par le CDC : tout numéro commence par 12. */
export const NUMERO_PREFIX = "12";
export const NUMERO_LONGUEUR = 12;

/**
 * Numéro de compte à 12 chiffres = "12" + 10 chiffres séquentiels zéro-paddés.
 * `seq` est un entier ≥ 1 (unicité garantie par la contrainte @unique en base,
 * avec retry côté endpoint en cas de collision concurrente).
 */
export function genererNumeroCompte(seq: number): string {
  const corps = String(seq).padStart(NUMERO_LONGUEUR - NUMERO_PREFIX.length, "0");
  return `${NUMERO_PREFIX}${corps}`;
}

/**
 * Clé RIB sur 2 chiffres, dérivée du numéro à 12 chiffres (contrôle de saisie).
 * clé = 97 − (numéro mod 97), dans [1..97].
 */
export function calculerCleRib(numeroCompte: string): string {
  // Le numéro tient sur 12 chiffres (< 2^53) → calcul exact en Number.
  const reste = Number(numeroCompte) % 97;
  const cle = 97 - reste; // ∈ [1..97]
  return String(cle).padStart(2, "0");
}

/** RIB complet affiché, ex : « TG-228 Afrs001 120000000001 96 ». */
export function formatRibComplet(
  codeAgence: string,
  codeGuichet: string,
  numeroCompte: string,
  cleRib: string,
): string {
  return `${codeAgence} ${codeGuichet} ${numeroCompte} ${cleRib}`;
}

/**
 * Charge le paramétrage du module (enregistrement unique id=1), en le créant
 * avec les valeurs par défaut du schéma s'il n'existe pas encore.
 */
export async function chargerParametrageCC() {
  const existant = await prisma.parametrageCompteCourant.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.parametrageCompteCourant.create({ data: { id: 1 } });
}

/** Référence unique d'un mouvement, ex : « DEP-20260706-00042 ». */
export async function genererReferenceMouvementCC(tx: TxClient, prefix = "MVT"): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await tx.mouvementCompteCourant.count();
  return `${prefix}-${ymd}-${String(count + 1).padStart(5, "0")}`;
}

async function genererReferenceEcriture(tx: TxClient, journal: string): Promise<string> {
  const prefix = journal.slice(0, 3).toUpperCase();
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await tx.ecritureComptable.count();
  return `${prefix}-${ym}-${String(count + 1).padStart(5, "0")}`;
}

export interface LigneEcritureCC { numero: string; debit?: number; credit?: number; libelle?: string }

/**
 * Crée une écriture comptable (BROUILLON) équilibrée à partir de numéros de compte.
 * Renvoie l'id de l'écriture, ou null si un compte du plan comptable est absent
 * (le mouvement reste enregistré ; l'écriture pourra être régularisée manuellement).
 */
export async function creerEcritureCC(
  tx: TxClient,
  opts: { journal: TypeJournalComptable; date: Date; libelle: string; userId: number; lignes: LigneEcritureCC[] },
): Promise<number | null> {
  const numeros = [...new Set(opts.lignes.map((l) => l.numero))];
  const comptes = await tx.compteComptable.findMany({
    where: { numero: { in: numeros } },
    select: { id: true, numero: true },
  });
  const map = new Map(comptes.map((c) => [c.numero, c.id]));
  if (opts.lignes.some((l) => !map.has(l.numero))) return null;

  const reference = await genererReferenceEcriture(tx, opts.journal);
  const ecriture = await tx.ecritureComptable.create({
    data: {
      reference, date: opts.date, libelle: opts.libelle, journal: opts.journal,
      statut: "BROUILLON", userId: opts.userId,
      lignes: {
        create: opts.lignes.map((l) => ({
          compteId: map.get(l.numero)!,
          libelle:  l.libelle ?? opts.libelle,
          debit:    new Prisma.Decimal(l.debit ?? 0),
          credit:   new Prisma.Decimal(l.credit ?? 0),
        })),
      },
    },
    select: { id: true },
  });
  return ecriture.id;
}

/**
 * Enregistre un dépôt (mouvement DEPOT) sur un compte courant dans la transaction
 * `tx` : écriture comptable Débit Caisse / Crédit Compte courant client, ligne au
 * grand livre, et mise à jour du solde + totaux du compte. Mutualisé entre le dépôt
 * courant (CDC §5) et le dépôt d'ouverture (CDC §2).
 *
 * Ne fait aucune validation métier (min/max, statut) : l'appelant les assure.
 */
export async function enregistrerDepotCC(
  tx: TxClient,
  opts: {
    compteId: number;
    numeroCompte: string;
    codeAgence: string;
    clientNom: string;
    montant: number;
    userId: number;
    param: { compteCaisseNumero: string; compteCourantClientNumero: string };
    modePaiement?: string | null;
    observation?: string | null;
    ip?: string | null;
    ouverture?: boolean;
  },
) {
  // Relecture du solde dans la transaction (cohérence).
  const courant = await tx.compteCourant.findUnique({ where: { id: opts.compteId }, select: { solde: true } });
  const avant = Number(courant?.solde ?? 0);
  const apres = avant + opts.montant;

  const libelleNature = opts.ouverture ? "Dépôt d'ouverture" : "Dépôt";
  const ecritureId = await creerEcritureCC(tx, {
    journal: "CAISSE",
    date: new Date(),
    libelle: `${libelleNature} compte courant ${opts.numeroCompte} — ${opts.clientNom}`,
    userId: opts.userId,
    lignes: [
      { numero: opts.param.compteCaisseNumero,        debit:  opts.montant, libelle: `Encaissement ${libelleNature.toLowerCase()} CC` },
      { numero: opts.param.compteCourantClientNumero, credit: opts.montant, libelle: `${libelleNature} ${opts.numeroCompte}` },
    ],
  });

  const reference = await genererReferenceMouvementCC(tx, "DEP");
  const mouvement = await tx.mouvementCompteCourant.create({
    data: {
      reference, compteId: opts.compteId, nature: "DEPOT",
      montant: opts.montant, soldeAvant: avant, soldeApres: apres,
      modePaiement: opts.modePaiement ?? null, observation: opts.observation ?? null,
      statut: "VALIDE", userId: opts.userId, agence: opts.codeAgence, ecritureId, ip: opts.ip ?? null,
    },
    select: { id: true, reference: true, createdAt: true },
  });

  await tx.compteCourant.update({
    where: { id: opts.compteId },
    data: {
      solde: apres,
      totalDepose: { increment: opts.montant },
      nbMouvements: { increment: 1 },
      derniereOperationAt: new Date(),
    },
  });

  return { mouvement, soldeAvant: avant, soldeApres: apres, ecritureGeneree: ecritureId != null };
}
