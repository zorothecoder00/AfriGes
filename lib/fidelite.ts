import { prisma } from "@/lib/prisma";
import { NiveauFidelite, TypeTransactionFidelite } from "@prisma/client";
import type { TxClient } from "@/lib/compteCourant";

/**
 * Programme de fidélité (CDC §19.D) : les clients qui alimentent régulièrement
 * leur compte gagnent des points (base proportionnelle au dépôt + bonus fixe par
 * dépôt), débloquant des niveaux et des avantages (réduction des frais de dossier,
 * priorité crédit, cadeaux).
 */

export interface ProgrammeConfig {
  actif: boolean;
  pointsParMontant: number;
  bonusParDepot: number;
  seuilArgent: number;
  seuilOr: number;
  seuilPlatine: number;
  reductionFraisArgent: number;
  reductionFraisOr: number;
  reductionFraisPlatine: number;
}

// Valeurs par défaut (avant tout paramétrage explicite).
export const PROGRAMME_DEFAUT: ProgrammeConfig = {
  actif: true, pointsParMontant: 1000, bonusParDepot: 0,
  seuilArgent: 500, seuilOr: 2000, seuilPlatine: 5000,
  reductionFraisArgent: 0, reductionFraisOr: 5, reductionFraisPlatine: 10,
};

export const NIVEAU_ORDRE: NiveauFidelite[] = ["BRONZE", "ARGENT", "OR", "PLATINE"];

/** Charge (et crée au besoin) le paramétrage singleton du programme. */
export async function chargerProgrammeFidelite() {
  const existant = await prisma.programmeFidelite.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.programmeFidelite.create({ data: { id: 1 } });
}

/** Niveau atteint pour un cumul de points gagnés. */
export function calculerNiveau(totalGagnes: number, prog: ProgrammeConfig): NiveauFidelite {
  if (totalGagnes >= prog.seuilPlatine) return "PLATINE";
  if (totalGagnes >= prog.seuilOr) return "OR";
  if (totalGagnes >= prog.seuilArgent) return "ARGENT";
  return "BRONZE";
}

/** Avantages débloqués par un niveau. */
export function avantagesFidelite(niveau: NiveauFidelite, prog: ProgrammeConfig) {
  const reductionFraisDossier =
    niveau === "PLATINE" ? prog.reductionFraisPlatine
    : niveau === "OR" ? prog.reductionFraisOr
    : niveau === "ARGENT" ? prog.reductionFraisArgent
    : 0;
  return {
    reductionFraisDossier,                       // % de réduction des frais de dossier crédit
    prioriteCredit: niveau === "OR" || niveau === "PLATINE",
    cadeaux: niveau === "PLATINE",
  };
}

/** Progression vers le niveau suivant. */
export function progressionNiveau(totalGagnes: number, prog: ProgrammeConfig) {
  const niveau = calculerNiveau(totalGagnes, prog);
  const paliers: { niveau: NiveauFidelite; seuil: number }[] = [
    { niveau: "ARGENT", seuil: prog.seuilArgent },
    { niveau: "OR", seuil: prog.seuilOr },
    { niveau: "PLATINE", seuil: prog.seuilPlatine },
  ];
  const prochain = paliers.find((p) => totalGagnes < p.seuil);
  if (!prochain) return { prochainNiveau: null as NiveauFidelite | null, seuilProchain: null as number | null, restant: 0, pct: 100 };
  const base = niveau === "BRONZE" ? 0 : niveau === "ARGENT" ? prog.seuilArgent : prog.seuilOr;
  const pct = prochain.seuil > base ? Math.min(100, Math.round(((totalGagnes - base) / (prochain.seuil - base)) * 100)) : 0;
  return { prochainNiveau: prochain.niveau, seuilProchain: prochain.seuil, restant: Math.max(0, prochain.seuil - totalGagnes), pct };
}

/**
 * Attribue (ou retire) des points à un client, dans une transaction fournie :
 * crée une ligne de grand livre, met à jour solde/cumuls et recalcule le niveau.
 * Lève « POINTS_INSUFFISANTS » si une dépense dépasse le solde disponible.
 */
export async function attribuerPointsFidelite(
  tx: TxClient,
  opts: {
    clientId: number; points: number; type: TypeTransactionFidelite; motif: string;
    source?: string | null; mouvementId?: number | null; creeParId?: number | null;
  },
): Promise<{ soldePoints: number; totalGagnes: number; niveau: NiveauFidelite; niveauMonte: boolean }> {
  const progRow = await tx.programmeFidelite.findUnique({ where: { id: 1 } });
  const prog: ProgrammeConfig = progRow ?? PROGRAMME_DEFAUT;

  const compte = await tx.compteFidelite.upsert({
    where: { clientId: opts.clientId },
    create: { clientId: opts.clientId },
    update: {},
    select: { id: true, soldePoints: true, totalGagnes: true, totalUtilises: true, niveau: true },
  });

  const gain = opts.points >= 0;
  if (!gain && compte.soldePoints + opts.points < 0) throw new Error("POINTS_INSUFFISANTS");

  const soldePoints = compte.soldePoints + opts.points;
  const totalGagnes = compte.totalGagnes + (gain ? opts.points : 0);
  const totalUtilises = compte.totalUtilises + (gain ? 0 : -opts.points);
  const niveau = calculerNiveau(totalGagnes, prog);

  await tx.transactionFidelite.create({
    data: {
      compteFideliteId: compte.id, type: opts.type, points: opts.points, motif: opts.motif,
      source: opts.source ?? null, mouvementId: opts.mouvementId ?? null, creeParId: opts.creeParId ?? null,
    },
  });
  await tx.compteFidelite.update({
    where: { id: compte.id },
    data: { soldePoints, totalGagnes, totalUtilises, niveau },
  });

  return { soldePoints, totalGagnes, niveau, niveauMonte: NIVEAU_ORDRE.indexOf(niveau) > NIVEAU_ORDRE.indexOf(compte.niveau) };
}

/**
 * Attribution automatique des points sur un dépôt (CDC §19.D) — appelée depuis
 * `enregistrerDepotCC`. Points = ⌊montant / pointsParMontant⌋ + bonusParDepot.
 * Renvoie null si le programme est inactif ou si le dépôt ne rapporte aucun point.
 */
export async function attribuerPointsDepot(
  tx: TxClient,
  opts: { clientId: number; montant: number; mouvementId?: number | null },
): Promise<{ points: number; niveauMonte: boolean; niveau: NiveauFidelite } | null> {
  const progRow = await tx.programmeFidelite.findUnique({ where: { id: 1 } });
  const prog: ProgrammeConfig = progRow ?? PROGRAMME_DEFAUT;
  if (!prog.actif) return null;

  const base = prog.pointsParMontant > 0 ? Math.floor(opts.montant / prog.pointsParMontant) : 0;
  const points = base + prog.bonusParDepot;
  if (points <= 0) return null;

  const r = await attribuerPointsFidelite(tx, {
    clientId: opts.clientId, points, type: "GAIN",
    motif: `Dépôt de ${opts.montant.toLocaleString("fr-FR")} FCFA`,
    source: "DEPOT", mouvementId: opts.mouvementId ?? null,
  });
  return { points, niveauMonte: r.niveauMonte, niveau: r.niveau };
}

/** Résumé fidélité d'un client (solde, niveau, avantages, progression). */
export async function getFidelite(clientId: number) {
  const prog = await chargerProgrammeFidelite();
  const compte = await prisma.compteFidelite.findUnique({
    where: { clientId },
    select: { soldePoints: true, totalGagnes: true, totalUtilises: true, niveau: true },
  });
  const totalGagnes = compte?.totalGagnes ?? 0;
  const niveau: NiveauFidelite = compte?.niveau ?? "BRONZE";
  return {
    soldePoints: compte?.soldePoints ?? 0,
    totalGagnes,
    totalUtilises: compte?.totalUtilises ?? 0,
    niveau,
    avantages: avantagesFidelite(niveau, prog),
    progression: progressionNiveau(totalGagnes, prog),
    bareme: { pointsParMontant: prog.pointsParMontant, bonusParDepot: prog.bonusParDepot },
  };
}
