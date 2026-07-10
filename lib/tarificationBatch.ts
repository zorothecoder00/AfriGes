import { prisma } from "@/lib/prisma";
import { TypePrix, PorteePrix } from "@prisma/client";

/**
 * Résolution de prix **batchée** (Catalogue §4/§8) — SERVEUR.
 * Équivalent de `resoudrePrix` mais pour une liste de produits en UNE requête,
 * afin d'afficher les prix résolus (agence / crédit) dans les listes et modales
 * de vente sans N+1. Ne gère que les portées GLOBAL et AGENCE (les portées
 * VILLE/REGION restent résolues au cas par cas côté checkout via `resoudrePrix`).
 */

const PRIORITE_PORTEE: Record<PorteePrix, number> = { AGENCE: 3, VILLE: 2, REGION: 1, GLOBAL: 0 };

/**
 * Renvoie, pour chaque produit, le montant applicable par type demandé
 * (Map produitId → { [type]: montant }). Un type absent = aucune ligne tarifée.
 */
export async function resoudrePrixBatch(
  produitIds: number[],
  types: TypePrix[],
  ctx: { pointDeVenteId?: number | null } = {},
  now: Date = new Date(),
): Promise<Map<number, Partial<Record<TypePrix, number>>>> {
  const out = new Map<number, Partial<Record<TypePrix, number>>>();
  if (produitIds.length === 0 || types.length === 0) return out;

  const lignes = await prisma.prixProduit.findMany({
    where: {
      produitId: { in: produitIds },
      type: { in: types },
      actif: true,
      OR: [{ dateDebut: null }, { dateDebut: { lte: now } }],
      AND: [{ OR: [{ dateFin: null }, { dateFin: { gte: now } }] }],
    },
    select: { produitId: true, type: true, montant: true, portee: true, pointDeVenteId: true },
  });

  // Garde la ligne la plus spécifique (AGENCE > GLOBAL) par (produit, type).
  const best = new Map<string, { montant: number; prio: number }>();
  for (const l of lignes) {
    const geoOk =
      l.portee === "GLOBAL" ||
      (l.portee === "AGENCE" && ctx.pointDeVenteId != null && l.pointDeVenteId === ctx.pointDeVenteId);
    if (!geoOk) continue;
    const key = `${l.produitId}:${l.type}`;
    const prio = PRIORITE_PORTEE[l.portee];
    const cur = best.get(key);
    if (!cur || prio > cur.prio) best.set(key, { montant: Number(l.montant), prio });
  }

  for (const [key, v] of best) {
    const [pid, type] = key.split(":");
    const id = Number(pid);
    const rec = out.get(id) ?? {};
    rec[type as TypePrix] = v.montant;
    out.set(id, rec);
  }
  return out;
}
