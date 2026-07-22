// lib/popc/comptabiliteServer.ts
// §15.1 — Connexion à la Comptabilité : charges RÉELLES du mois pour la
// comparaison budget/réel du pilotage Direction. Serveur uniquement.
//
// « Charge réelle » = solde net (débit − crédit) des lignes d'écriture imputées
// sur des comptes de type CHARGES (classe 6 SYSCOHADA), sur les écritures dont la
// date tombe dans le mois. Aucune ressaisie : lecture directe du grand livre.

import { prisma } from "@/lib/prisma";

export interface ChargesReelles {
  reel: number;
  parCompte: { numero: string; libelle: string; montant: number }[];
}

/** Charges réelles comptabilisées sur un mois (global — la compta n'est pas ventilée par PDV). */
export async function chargesReellesComptables(annee: number, mois: number): Promise<ChargesReelles> {
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 1));

  const lignes = await prisma.ligneEcriture.findMany({
    where: {
      compte: { type: "CHARGES" },
      ecriture: { date: { gte: debut, lt: fin } },
    },
    select: {
      debit: true, credit: true,
      compte: { select: { numero: true, libelle: true } },
    },
  });

  // Agrégation par compte (débit − crédit = charge nette, hors contre-passations).
  const parCompteMap = new Map<string, { numero: string; libelle: string; montant: number }>();
  for (const l of lignes) {
    const net = Number(l.debit) - Number(l.credit);
    const cur = parCompteMap.get(l.compte.numero)
      ?? { numero: l.compte.numero, libelle: l.compte.libelle, montant: 0 };
    cur.montant += net;
    parCompteMap.set(l.compte.numero, cur);
  }

  const parCompte = [...parCompteMap.values()]
    .map((c) => ({ ...c, montant: Number(c.montant.toFixed(2)) }))
    .filter((c) => Math.abs(c.montant) > 0.009)
    .sort((a, b) => b.montant - a.montant);

  const reel = Number(parCompte.reduce((s, c) => s + c.montant, 0).toFixed(2));
  return { reel, parCompte };
}
