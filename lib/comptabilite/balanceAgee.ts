// lib/comptabilite/balanceAgee.ts
//
// Balance âgée clients/fournisseurs (CDC Comptabilité §16-17) : ventile le solde
// dû de chaque tiers par ancienneté (0-30j / 31-60j / 61-90j / 90j+), à partir
// du RELIQUAT non lettré des lignes de son compte auxiliaire
// (lib/comptabilite/lettrage.ts) — une facture lettrée intégralement par son
// règlement n'apparaît plus ici ; une facture lettrée PARTIELLEMENT (CDC §18,
// ex. 500k facturés / 300k réglés) n'apparaît plus que pour son reliquat de
// 200k, jamais pour son montant plein. L'âge retenu est la date de l'écriture
// d'origine (la facture), pas la date du jour.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface LigneBalanceAgee {
  tiersId: number;
  tiersNom: string;
  compteNumero: string;
  tranche0_30: number;
  tranche31_60: number;
  tranche61_90: number;
  tranche90Plus: number;
  total: number;
}

function trancheIndex(joursAge: number): 0 | 1 | 2 | 3 {
  if (joursAge <= 30) return 0;
  if (joursAge <= 60) return 1;
  if (joursAge <= 90) return 2;
  return 3;
}

/**
 * `type` détermine le préfixe de compte (411 clients / 401 fournisseurs) et le
 * sens du solde dû (débiteur pour un client, créditeur pour un fournisseur).
 */
export async function genererBalanceAgee(
  tx: TxClient,
  type: "CLIENT" | "FOURNISSEUR",
  dateRef: Date = new Date(),
): Promise<LigneBalanceAgee[]> {
  const comptes = await tx.compteComptable.findMany({
    where: type === "CLIENT" ? { clientId: { not: null } } : { fournisseurId: { not: null } },
    select: {
      id: true, numero: true,
      client: { select: { id: true, nom: true, prenom: true } },
      fournisseur: { select: { id: true, nom: true } },
    },
  });
  if (comptes.length === 0) return [];

  const lignes = await tx.ligneEcriture.findMany({
    where: {
      compteId: { in: comptes.map((c) => c.id) },
      ecriture: { statut: { in: ["VALIDE", "CLOTURE"] } },
    },
    select: { compteId: true, debit: true, credit: true, montantLettre: true, ecriture: { select: { date: true } } },
  });

  const parCompte = new Map<number, LigneBalanceAgee>();
  for (const c of comptes) {
    const tiersId = type === "CLIENT" ? c.client?.id : c.fournisseur?.id;
    if (tiersId == null) continue;
    const tiersNom = type === "CLIENT"
      ? `${c.client?.prenom ?? ""} ${c.client?.nom ?? ""}`.trim()
      : (c.fournisseur?.nom ?? "");
    parCompte.set(c.id, {
      tiersId, tiersNom, compteNumero: c.numero,
      tranche0_30: 0, tranche31_60: 0, tranche61_90: 0, tranche90Plus: 0, total: 0,
    });
  }

  for (const l of lignes) {
    const ligneBalance = parCompte.get(l.compteId);
    if (!ligneBalance) continue;
    // CDC §18 — reliquat non lettré de la ligne, pas son montant plein.
    const reliquatDebit = Math.max(0, Number(l.debit) - Number(l.montantLettre));
    const reliquatCredit = Math.max(0, Number(l.credit) - Number(l.montantLettre));
    const solde = type === "CLIENT" ? reliquatDebit - reliquatCredit : reliquatCredit - reliquatDebit;
    if (Math.abs(solde) < 0.01) continue;

    const joursAge = Math.floor((dateRef.getTime() - l.ecriture.date.getTime()) / (1000 * 60 * 60 * 24));
    const idx = trancheIndex(Math.max(0, joursAge));
    if (idx === 0) ligneBalance.tranche0_30 += solde;
    else if (idx === 1) ligneBalance.tranche31_60 += solde;
    else if (idx === 2) ligneBalance.tranche61_90 += solde;
    else ligneBalance.tranche90Plus += solde;
    ligneBalance.total += solde;
  }

  return [...parCompte.values()]
    .filter((l) => Math.abs(l.total) >= 0.01)
    .sort((a, b) => b.total - a.total);
}
