// lib/comptabilite/lettrage.ts
//
// CDC §18 — lettrage : rapprocher les lignes d'un même compte auxiliaire (ex.
// une facture soldée par son paiement). Un groupe ÉQUILIBRÉ (débit total =
// crédit total) est un lettrage classique intégral. Un groupe DÉSÉQUILIBRÉ
// (ex. facture 500k / paiement 300k) est un lettrage PARTIEL : seule la part
// commune est soldée, répartie au prorata entre les lignes du côté
// excédentaire ; le reliquat (montant - montantLettre) reste "en instance" sur
// chaque ligne concernée. Le moteur propose des correspondances (exactes puis
// partielles) ; le comptable confirme toujours avant application.
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

function montantLigne(l: { debit: Prisma.Decimal | number; credit: Prisma.Decimal | number }): number {
  return Number(l.debit) > 0 ? Number(l.debit) : Number(l.credit);
}

function disponible(l: { debit: Prisma.Decimal | number; credit: Prisma.Decimal | number; montantLettre: Prisma.Decimal | number }): number {
  return montantLigne(l) - Number(l.montantLettre);
}

/** Lignes du compte encore "en instance" : jamais lettrées, ou lettrées partiellement (reliquat > 0). */
export async function lignesNonLettrees(tx: TxClient, compteId: number) {
  const lignes = await tx.ligneEcriture.findMany({
    where: { compteId },
    include: { ecriture: { select: { reference: true, date: true, statut: true, libelle: true } } },
    orderBy: { ecriture: { date: "asc" } },
  });
  return lignes
    .map((l) => ({ ...l, reliquat: disponible(l) }))
    .filter((l) => l.reliquat > 0.01);
}

export interface PropositionLettrage {
  ligneIds: number[];
  montant: number;
  /** CDC §18 — présent uniquement pour une correspondance partielle (débit ≠ crédit). */
  partiel?: boolean;
  reliquat?: number;
}

/**
 * Propose des rapprochements pour les lignes en instance d'un compte : d'abord
 * les correspondances exactes (débit = crédit à 0.01 près), puis, pour les
 * lignes restantes, la meilleure correspondance partielle disponible (CDC §18
 * — le reliquat est calculé et retourné pour information, rien n'est appliqué ici).
 */
export async function proposerLettrage(tx: TxClient, compteId: number): Promise<PropositionLettrage[]> {
  const lignes = await lignesNonLettrees(tx, compteId);
  const debits = lignes.filter((l) => Number(l.debit) > 0).map((l) => ({ id: l.id, montant: l.reliquat }));
  const credits = lignes.filter((l) => Number(l.credit) > 0).map((l) => ({ id: l.id, montant: l.reliquat }));
  const propositions: PropositionLettrage[] = [];
  const creditsUtilises = new Set<number>();

  for (const d of debits) {
    const match = credits.find((c) => !creditsUtilises.has(c.id) && Math.abs(c.montant - d.montant) < 0.01);
    if (match) {
      propositions.push({ ligneIds: [d.id, match.id], montant: d.montant });
      creditsUtilises.add(match.id);
    }
  }

  const debitsAppaires = new Set(propositions.flatMap((p) => p.ligneIds));
  for (const d of debits) {
    if (debitsAppaires.has(d.id)) continue;
    const disponibles = credits.filter((c) => !creditsUtilises.has(c.id));
    if (!disponibles.length) continue;
    const meilleur = disponibles.reduce((a, b) => (Math.abs(b.montant - d.montant) < Math.abs(a.montant - d.montant) ? b : a));
    const montantCommun = Math.min(d.montant, meilleur.montant);
    propositions.push({
      ligneIds: [d.id, meilleur.id],
      montant: montantCommun,
      partiel: true,
      reliquat: Math.abs(d.montant - meilleur.montant),
    });
    creditsUtilises.add(meilleur.id);
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
 * Lettre un groupe de lignes du même compte. Si le groupe est équilibré
 * (débit total = crédit total restant disponible), lettrage classique
 * intégral. Sinon (CDC §18), lettrage PARTIEL : seule la part commune
 * (min(débit, crédit) disponible) est soldée, répartie au prorata entre les
 * lignes du côté excédentaire — chaque ligne garde son reliquat et réapparaît
 * dans `lignesNonLettrees` tant qu'il n'est pas nul, mais porte déjà le code
 * de lettrage pour tracer le rapprochement partiel effectué.
 */
export async function appliquerLettrage(tx: TxClient, ligneIds: number[]): Promise<string> {
  if (ligneIds.length < 2) throw new Error("LETTRAGE_MIN_2_LIGNES");

  const lignes = await tx.ligneEcriture.findMany({ where: { id: { in: ligneIds } } });
  if (lignes.length !== ligneIds.length) throw new Error("LIGNE_INTROUVABLE");
  if (new Set(lignes.map((l) => l.compteId)).size > 1) throw new Error("COMPTES_DIFFERENTS");
  if (lignes.some((l) => disponible(l) <= 0.01)) throw new Error("DEJA_LETTREE");

  const totalDebit = lignes.reduce((s, l) => s + (Number(l.debit) > 0 ? disponible(l) : 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (Number(l.credit) > 0 ? disponible(l) : 0), 0);
  const montantCommun = Math.min(totalDebit, totalCredit);
  if (montantCommun <= 0.01) throw new Error("AUCUN_MONTANT_COMMUN");

  const code = await genererCodeLettrage(tx);
  await Promise.all(lignes.map((l) => {
    const dispo = disponible(l);
    const cote = Number(l.debit) > 0 ? totalDebit : totalCredit;
    const quotePart = cote > 0.01 ? (dispo / cote) * montantCommun : 0;
    return tx.ligneEcriture.update({
      where: { id: l.id },
      data: { lettrage: code, montantLettre: Number(l.montantLettre) + quotePart },
    });
  }));
  return code;
}

/** Délettre entièrement un groupe : remet lettrage=null et montantLettre=0 sur toutes ses lignes. */
export async function delettrer(tx: TxClient, code: string): Promise<number> {
  const res = await tx.ligneEcriture.updateMany({ where: { lettrage: code }, data: { lettrage: null, montantLettre: 0 } });
  return res.count;
}
