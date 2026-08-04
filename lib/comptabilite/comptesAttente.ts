// lib/comptabilite/comptesAttente.ts
//
// Surveillance des comptes d'attente (CDC §41) : lignes portées par le compte
// d'attente général (471 "Débiteurs divers") non encore résolues. Le lettrage
// (CDC §18, générique à tout compte via /api/comptable/lettrage, pas réservé
// aux comptes clients/fournisseurs) sert ici de mécanisme de "résolution" :
// une ligne d'attente reste visible tant qu'elle n'a pas été rapprochée de sa
// contrepartie de reclassification vers son compte définitif.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface EcritureAttente {
  ligneId: number;
  ecritureId: number;
  reference: string;
  montant: number;
  date: Date;
  origine: string;
  libelle: string;
  utilisateur: string | null;
  aPiece: boolean;
  delaiJours: number;
}

const COMPTE_ATTENTE_NUMERO = "471";

/** Écritures en attente d'imputation (CDC §41) : lignes non lettrées du compte 471. */
export async function genererEcrituresAttente(tx: TxClient): Promise<EcritureAttente[]> {
  const compte = await tx.compteComptable.findUnique({ where: { numero: COMPTE_ATTENTE_NUMERO }, select: { id: true } });
  if (!compte) return [];

  const lignes = await tx.ligneEcriture.findMany({
    where: { compteId: compte.id, lettrage: null, ecriture: { statut: { in: ["VALIDE", "CLOTURE"] } } },
    select: {
      id: true, debit: true, credit: true, libelle: true,
      ecriture: {
        select: {
          id: true, reference: true, date: true, journal: true, libelle: true,
          user: { select: { nom: true, prenom: true } },
        },
      },
    },
    orderBy: { ecriture: { date: "asc" } },
  });
  if (lignes.length === 0) return [];

  const ecritureIds = [...new Set(lignes.map((l) => l.ecriture.id))];
  const pieces = await tx.pieceJustificative.findMany({
    where: { sourceType: "ECRITURE_COMPTABLE", sourceId: { in: ecritureIds } },
    select: { sourceId: true },
  });
  const idsAvecPiece = new Set(pieces.map((p) => p.sourceId));

  const maintenant = Date.now();
  return lignes.map((l) => ({
    ligneId: l.id,
    ecritureId: l.ecriture.id,
    reference: l.ecriture.reference,
    montant: Number(l.debit) - Number(l.credit),
    date: l.ecriture.date,
    origine: l.ecriture.journal,
    libelle: l.libelle || l.ecriture.libelle,
    utilisateur: l.ecriture.user ? `${l.ecriture.user.prenom} ${l.ecriture.user.nom}` : null,
    aPiece: idsAvecPiece.has(l.ecriture.id),
    delaiJours: Math.floor((maintenant - l.ecriture.date.getTime()) / (24 * 60 * 60 * 1000)),
  }));
}
