import type { TxClient } from "@/lib/compteCourant";
import { attribuerPointsFidelite } from "@/lib/fidelite";

/**
 * Rachat de récompenses (CDC §36) — branché sur CompteFidelite (source de
 * vérité active), PAS sur la legacy PointsFidelite/UtilisationRecompense.
 * Le catalogue RecompenseFidelite existait déjà en base mais n'était branché
 * nulle part avant cette phase (cf. mémoire projet). Rachat déclenché côté
 * staff (marketing/agence) sur la fiche d'un client — aucune appli client
 * n'existe dans ce codebase.
 */

/**
 * Échange une récompense du catalogue contre des points d'un client.
 * Vérifie l'actif/l'expiration/le solde suffisant, dépense les points via
 * `attribuerPointsFidelite` (type DEPENSE) et crée le `RecompenseEchange`
 * (statut DISPONIBLE — à marquer UTILISEE séparément quand la remise
 * physique/le geste commercial est confirmé par le staff).
 */
export async function echangerRecompense(
  tx: TxClient,
  opts: { clientId: number; recompenseId: number; creeParId: number },
) {
  const recompense = await tx.recompenseFidelite.findUnique({
    where: { id: opts.recompenseId },
    select: { id: true, nom: true, actif: true, coutPoints: true, dateExpiration: true },
  });
  if (!recompense) throw new Error("RECOMPENSE_INTROUVABLE");
  if (!recompense.actif) throw new Error("RECOMPENSE_INACTIVE");
  if (recompense.dateExpiration && recompense.dateExpiration < new Date()) throw new Error("RECOMPENSE_EXPIREE");

  const compte = await tx.compteFidelite.findUnique({
    where: { clientId: opts.clientId },
    select: { soldePoints: true },
  });
  if (!compte || compte.soldePoints < recompense.coutPoints) throw new Error("POINTS_INSUFFISANTS");

  await attribuerPointsFidelite(tx, {
    clientId: opts.clientId,
    points: -recompense.coutPoints,
    type: "DEPENSE",
    motif: `Échange récompense « ${recompense.nom} »`,
    source: "RECOMPENSE",
    creeParId: opts.creeParId,
  });

  const compteFidelite = await tx.compteFidelite.findUniqueOrThrow({
    where: { clientId: opts.clientId },
    select: { id: true },
  });

  return tx.recompenseEchange.create({
    data: {
      recompenseId: recompense.id,
      compteFideliteId: compteFidelite.id,
      pointsUtilises: recompense.coutPoints,
      statut: "DISPONIBLE",
      creeParId: opts.creeParId,
    },
    include: { recompense: { select: { nom: true, type: true } } },
  });
}

/** Marque un échange comme utilisé (remise physique/avantage confirmé par le staff). */
export async function marquerRecompenseUtilisee(tx: TxClient, echangeId: number) {
  const echange = await tx.recompenseEchange.findUnique({ where: { id: echangeId }, select: { statut: true } });
  if (!echange) throw new Error("ECHANGE_INTROUVABLE");
  if (echange.statut !== "DISPONIBLE") throw new Error("ECHANGE_DEJA_TRAITE");
  return tx.recompenseEchange.update({
    where: { id: echangeId },
    data: { statut: "UTILISEE", dateUtilisation: new Date() },
  });
}
