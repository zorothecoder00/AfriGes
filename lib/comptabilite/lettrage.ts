// lib/comptabilite/lettrage.ts
//
// Lettrage des écritures (CDC Comptabilité §18) : rapprocher les lignes d'un même
// compte auxiliaire dont la somme débit = somme crédit (ex. une facture soldée
// par son paiement), pour ne laisser apparaître dans le suivi que le reliquat
// réellement dû. Le moteur propose des correspondances exactes ; le comptable
// confirme toujours avant application (jamais automatique et silencieux).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/** Lignes non lettrées d'un compte, triées par date d'écriture. */
export async function lignesNonLettrees(tx: TxClient, compteId: number) {
  return tx.ligneEcriture.findMany({
    where: { compteId, lettrage: null },
    include: { ecriture: { select: { reference: true, date: true, statut: true, libelle: true } } },
    orderBy: { ecriture: { date: "asc" } },
  });
}

export interface PropositionLettrage {
  ligneIds: number[];
  montant: number;
}

/**
 * Propose des correspondances exactes 1-pour-1 (une ligne au débit dont le
 * montant correspond exactement à une ligne au crédit non encore utilisée).
 * Le comptable confirme (ou ignore) chaque proposition — rien n'est appliqué ici.
 */
export async function proposerLettrage(tx: TxClient, compteId: number): Promise<PropositionLettrage[]> {
  const lignes = await lignesNonLettrees(tx, compteId);
  const debits = lignes.filter((l) => Number(l.debit) > 0);
  const credits = lignes.filter((l) => Number(l.credit) > 0);

  const propositions: PropositionLettrage[] = [];
  const creditsUtilises = new Set<number>();

  for (const d of debits) {
    const montantDebit = Number(d.debit);
    const match = credits.find((c) => !creditsUtilises.has(c.id) && Math.abs(Number(c.credit) - montantDebit) < 0.01);
    if (match) {
      propositions.push({ ligneIds: [d.id, match.id], montant: montantDebit });
      creditsUtilises.add(match.id);
    }
  }
  return propositions;
}

async function genererCodeLettrage(tx: TxClient): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = `L${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    const exists = await tx.ligneEcriture.findFirst({ where: { lettrage: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("GENERATION_CODE_LETTRAGE_ECHOUEE");
}

/**
 * Applique le lettrage à un ensemble de lignes du même compte : vérifie qu'aucune
 * n'est déjà lettrée et que la somme débit = somme crédit, puis leur assigne un
 * code commun. Retourne le code généré.
 */
export async function appliquerLettrage(tx: TxClient, ligneIds: number[]): Promise<string> {
  if (ligneIds.length < 2) throw new Error("LETTRAGE_MIN_2_LIGNES");

  const lignes = await tx.ligneEcriture.findMany({ where: { id: { in: ligneIds } } });
  if (lignes.length !== ligneIds.length) throw new Error("LIGNE_INTROUVABLE");
  if (new Set(lignes.map((l) => l.compteId)).size > 1) throw new Error("COMPTES_DIFFERENTS");
  if (lignes.some((l) => l.lettrage)) throw new Error("DEJA_LETTREE");

  const totalDebit = lignes.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lignes.reduce((s, l) => s + Number(l.credit), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error("LIGNES_NON_EQUILIBREES");

  const code = await genererCodeLettrage(tx);
  await tx.ligneEcriture.updateMany({ where: { id: { in: ligneIds } }, data: { lettrage: code } });
  return code;
}

/** Retire le lettrage d'un groupe (le comptable s'est trompé de rapprochement). */
export async function delettrer(tx: TxClient, code: string): Promise<number> {
  const res = await tx.ligneEcriture.updateMany({ where: { lettrage: code }, data: { lettrage: null } });
  return res.count;
}
