// lib/comptabilite/clientAuxiliaire.ts
//
// Grand livre auxiliaire d'un client (CDC Comptabilité §16) : mouvements de
// son compte 411xxx avec solde progressif — brique commune au grand livre
// consultable et au relevé client imprimable (mêmes données, présentation
// différente).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

const STATUTS_COMPTABILISES = ["VALIDE", "CLOTURE"] as const;

export interface LigneGrandLivreClient {
  id: number; date: Date; reference: string; journal: string; libelle: string;
  debit: number; credit: number; lettrage: string | null; solde: number;
}

export interface GrandLivreClient {
  compte: { id: number; numero: string; libelle: string } | null;
  soldeOuverture: number;
  lignes: LigneGrandLivreClient[];
  soldeFinal: number;
}

export async function genererGrandLivreClient(
  tx: TxClient,
  clientId: number,
  periode: { dateDebut?: Date | null; dateFin?: Date | null } = {},
): Promise<GrandLivreClient> {
  const { dateDebut, dateFin } = periode;
  const compte = await tx.compteComptable.findUnique({
    where: { clientId },
    select: { id: true, numero: true, libelle: true },
  });
  if (!compte) return { compte: null, soldeOuverture: 0, lignes: [], soldeFinal: 0 };

  const soldeOuverture = dateDebut
    ? await tx.ligneEcriture
        .aggregate({
          where: { compteId: compte.id, ecriture: { statut: { in: [...STATUTS_COMPTABILISES] }, date: { lt: dateDebut } } },
          _sum: { debit: true, credit: true },
        })
        .then((agg) => Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0))
    : 0;

  const lignes = await tx.ligneEcriture.findMany({
    where: {
      compteId: compte.id,
      ecriture: {
        statut: { in: [...STATUTS_COMPTABILISES] },
        ...(dateDebut || dateFin ? { date: { ...(dateDebut && { gte: dateDebut }), ...(dateFin && { lte: dateFin }) } } : {}),
      },
    },
    include: { ecriture: { select: { reference: true, date: true, libelle: true, journal: true } } },
    orderBy: [{ ecriture: { date: "asc" } }, { id: "asc" }],
  });

  let solde = soldeOuverture;
  const lignesAvecSolde: LigneGrandLivreClient[] = lignes.map((l) => {
    solde += Number(l.debit) - Number(l.credit);
    return {
      id: l.id, date: l.ecriture.date, reference: l.ecriture.reference, journal: l.ecriture.journal,
      libelle: l.libelle || l.ecriture.libelle, debit: Number(l.debit), credit: Number(l.credit), lettrage: l.lettrage,
      solde,
    };
  });

  return { compte, soldeOuverture, lignes: lignesAvecSolde, soldeFinal: solde };
}
