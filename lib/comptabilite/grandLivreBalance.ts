// lib/comptabilite/grandLivreBalance.ts
//
// Balance générale (CDC Comptabilité §33) et grand livre par compte (§34) —
// tous deux dérivés exclusivement d'EcritureComptable/LigneEcriture/CompteComptable,
// jamais des modules opérationnels (même doctrine que lib/comptabilite/etatsFinanciers.ts
// et lib/comptabilite/clientAuxiliaire.ts, dont le grand livre par compte ici
// reprend le principe de solde progressif).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

const STATUTS_COMPTABILISES = ["VALIDE", "CLOTURE"] as const;

export interface FiltresBalanceGrandLivre {
  dateDebut: Date;
  dateFin: Date;
  compteId?: number;
  classe?: number;
  journal?: string;
  pointDeVenteId?: number;
  sectionAnalytiqueId?: number;
  tiersType?: "CLIENT" | "FOURNISSEUR";
}

function whereLignes(f: FiltresBalanceGrandLivre, borneDate: { lt?: Date; gte?: Date; lte?: Date }) {
  return {
    ...(f.compteId != null && { compteId: f.compteId }),
    ...(f.classe != null && { compte: { classe: f.classe } }),
    ...(f.journal && { ecriture: { journal: f.journal } }),
    ...(f.pointDeVenteId != null && { pointDeVenteId: f.pointDeVenteId }),
    ...(f.sectionAnalytiqueId != null && { sectionAnalytiqueId: f.sectionAnalytiqueId }),
    ...(f.tiersType === "CLIENT" && { compte: { clientId: { not: null } } }),
    ...(f.tiersType === "FOURNISSEUR" && { compte: { fournisseurId: { not: null } } }),
    ecriture: {
      statut: { in: [...STATUTS_COMPTABILISES] },
      date: borneDate,
      ...(f.journal && { journal: f.journal }),
    },
  };
}

export interface LigneBalanceGenerale {
  compteId: number; numero: string; libelle: string; classe: number;
  soldeInitial: number; mouvementDebit: number; mouvementCredit: number;
  soldeFinalDebiteur: number; soldeFinalCrediteur: number;
}

/**
 * Balance générale (CDC §33) : pour chaque compte mouvementé, solde initial
 * (cumul avant `dateDebut`), mouvements débit/crédit de la période, solde
 * final ventilé débiteur/créditeur (présentation standard d'une balance —
 * chaque compte apparaît dans la colonne de son solde réel, pas de son sens
 * "normal"). Ne retourne que les comptes non totalement à zéro sur la période.
 */
export async function genererBalanceGenerale(tx: TxClient, filtres: FiltresBalanceGrandLivre): Promise<LigneBalanceGenerale[]> {
  const [ouverture, mouvements] = await Promise.all([
    tx.ligneEcriture.groupBy({
      by: ["compteId"],
      where: whereLignes(filtres, { lt: filtres.dateDebut }),
      _sum: { debit: true, credit: true },
    }),
    tx.ligneEcriture.groupBy({
      by: ["compteId"],
      where: whereLignes(filtres, { gte: filtres.dateDebut, lte: filtres.dateFin }),
      _sum: { debit: true, credit: true },
    }),
  ]);

  const compteIds = [...new Set([...ouverture.map((o) => o.compteId), ...mouvements.map((m) => m.compteId)])];
  if (compteIds.length === 0) return [];

  const comptes = await tx.compteComptable.findMany({
    where: { id: { in: compteIds } },
    select: { id: true, numero: true, libelle: true, classe: true },
  });
  const compteParId = new Map(comptes.map((c) => [c.id, c]));
  const ouvertureParCompte = new Map(ouverture.map((o) => [o.compteId, o]));
  const mouvementsParCompte = new Map(mouvements.map((m) => [m.compteId, m]));

  const lignes: LigneBalanceGenerale[] = [];
  for (const compteId of compteIds) {
    const compte = compteParId.get(compteId);
    if (!compte) continue;
    const o = ouvertureParCompte.get(compteId);
    const m = mouvementsParCompte.get(compteId);
    const soldeInitial = Number(o?._sum.debit ?? 0) - Number(o?._sum.credit ?? 0);
    const mouvementDebit = Number(m?._sum.debit ?? 0);
    const mouvementCredit = Number(m?._sum.credit ?? 0);
    const soldeFinal = soldeInitial + mouvementDebit - mouvementCredit;
    if (Math.abs(soldeInitial) < 0.01 && mouvementDebit < 0.01 && mouvementCredit < 0.01) continue;

    lignes.push({
      compteId, numero: compte.numero, libelle: compte.libelle, classe: compte.classe,
      soldeInitial, mouvementDebit, mouvementCredit,
      soldeFinalDebiteur: soldeFinal > 0 ? soldeFinal : 0,
      soldeFinalCrediteur: soldeFinal < 0 ? -soldeFinal : 0,
    });
  }

  return lignes.sort((a, b) => a.numero.localeCompare(b.numero));
}

export interface LigneGrandLivreGenerique {
  id: number; date: Date; numeroPiece: string; journal: string; libelle: string;
  debit: number; credit: number; lettrage: string | null; solde: number;
  utilisateur: string | null;
}

/**
 * Grand livre (CDC §34) : mouvements d'UN compte quelconque du plan comptable
 * (pas seulement les auxiliaires 411xxx/401xxx — cf. lib/comptabilite/clientAuxiliaire.ts
 * pour la version dédiée client/fournisseur), avec solde progressif et un
 * solde d'ouverture optionnel si `dateDebut` est fourni.
 */
export async function genererGrandLivreCompte(
  tx: TxClient,
  compteId: number,
  periode: { dateDebut?: Date | null; dateFin?: Date | null } = {},
): Promise<{ compte: { numero: string; libelle: string } | null; soldeOuverture: number; lignes: LigneGrandLivreGenerique[]; soldeFinal: number }> {
  const compte = await tx.compteComptable.findUnique({ where: { id: compteId }, select: { numero: true, libelle: true } });
  if (!compte) return { compte: null, soldeOuverture: 0, lignes: [], soldeFinal: 0 };

  const { dateDebut, dateFin } = periode;
  const soldeOuverture = dateDebut
    ? await tx.ligneEcriture
        .aggregate({
          where: { compteId, ecriture: { statut: { in: [...STATUTS_COMPTABILISES] }, date: { lt: dateDebut } } },
          _sum: { debit: true, credit: true },
        })
        .then((agg) => Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0))
    : 0;

  const lignes = await tx.ligneEcriture.findMany({
    where: {
      compteId,
      ecriture: {
        statut: { in: [...STATUTS_COMPTABILISES] },
        ...(dateDebut || dateFin ? { date: { ...(dateDebut && { gte: dateDebut }), ...(dateFin && { lte: dateFin }) } } : {}),
      },
    },
    include: { ecriture: { select: { reference: true, date: true, libelle: true, journal: true, user: { select: { nom: true, prenom: true } } } } },
    orderBy: [{ ecriture: { date: "asc" } }, { id: "asc" }],
  });

  let solde = soldeOuverture;
  const lignesAvecSolde: LigneGrandLivreGenerique[] = lignes.map((l) => {
    solde += Number(l.debit) - Number(l.credit);
    return {
      id: l.id, date: l.ecriture.date, numeroPiece: l.ecriture.reference, journal: l.ecriture.journal,
      libelle: l.libelle || l.ecriture.libelle, debit: Number(l.debit), credit: Number(l.credit), lettrage: l.lettrage,
      solde, utilisateur: l.ecriture.user ? `${l.ecriture.user.prenom} ${l.ecriture.user.nom}` : null,
    };
  });

  return { compte, soldeOuverture, lignes: lignesAvecSolde, soldeFinal: solde };
}
