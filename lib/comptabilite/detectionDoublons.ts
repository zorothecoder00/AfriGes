// lib/comptabilite/detectionDoublons.ts
//
// Détection de doublons potentiels avant validation (CDC §42) : avant de créer
// une écriture, compare journal + date + montant + référence/libellé à
// l'existant pour repérer une saisie en double (ex. une même facture
// fournisseur saisie deux fois) — l'utilisateur doit explicitement confirmer
// pour passer outre (mécanisme identique à la dérogation période fermée,
// CDC §29). Contrairement à `controlerDoublons` (lib/comptabilite/controles.ts,
// §40), qui scanne a posteriori toutes les écritures déjà validées pour un
// contrôle de cohérence global, cette fonction s'exécute AVANT la création,
// pour UNE écriture candidate précise (le CDC ne définit pas de champ dédié
// "numéro de facture fournisseur" en base — le rapprochement se fait donc sur
// journal + date + montant + recoupement textuel référence/libellé, qui
// contient en pratique le numéro de facture saisi par le comptable).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface DoublonPotentiel {
  ecritureId: number;
  reference: string;
  date: Date;
  libelle: string;
  montant: number;
}

export interface CandidatEcriture {
  journal: string;
  date: Date;
  montant: number;
  reference?: string | null;
  libelle: string;
}

/**
 * Recherche des écritures déjà existantes le même jour, dans le même journal,
 * pour un montant identique (±0.01), dont la référence ou le libellé se
 * recoupent textuellement avec la saisie candidate.
 */
export async function detecterDoublonPotentiel(tx: TxClient, candidat: CandidatEcriture): Promise<DoublonPotentiel[]> {
  const dateMin = new Date(candidat.date);
  dateMin.setHours(0, 0, 0, 0);
  const dateMax = new Date(dateMin);
  dateMax.setDate(dateMax.getDate() + 1);

  const candidats = await tx.ecritureComptable.findMany({
    where: {
      journal: candidat.journal,
      date: { gte: dateMin, lt: dateMax },
      NOT: { reference: { startsWith: "CP-" } }, // exclut les contrepassations
    },
    select: { id: true, reference: true, date: true, libelle: true, lignes: { select: { debit: true } } },
    take: 50,
  });

  const libelleNorm = candidat.libelle.trim().toLowerCase();
  const referenceNorm = candidat.reference?.trim().toLowerCase();

  return candidats
    .map((e) => ({ e, montant: e.lignes.reduce((s, l) => s + Number(l.debit), 0) }))
    .filter(({ montant }) => Math.abs(montant - candidat.montant) < 0.01 && montant > 0)
    .filter(({ e }) => {
      const eLibelle = e.libelle.trim().toLowerCase();
      const memeLibelle = eLibelle === libelleNorm;
      const memeReference = !!referenceNorm && e.reference.trim().toLowerCase() === referenceNorm;
      // Recoupement partiel : le libellé de l'un contient celui de l'autre
      // (ex. "Facture FAC-2026-00123" apparaît dans les deux saisies).
      const recoupementPartiel = libelleNorm.length > 3 && (eLibelle.includes(libelleNorm) || libelleNorm.includes(eLibelle));
      return memeLibelle || memeReference || recoupementPartiel;
    })
    .map(({ e, montant }) => ({ ecritureId: e.id, reference: e.reference, date: e.date, libelle: e.libelle, montant }));
}
