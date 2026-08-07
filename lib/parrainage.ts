import { prisma } from "@/lib/prisma";
import type { TxClient } from "@/lib/compteCourant";
import { attribuerPointsFidelite } from "@/lib/fidelite";

/**
 * Parrainage (CDC §2, §84) — structure simple : un parrain (Client), un
 * filleul (Client, un seul parrain possible), qualification = premier achat
 * du filleul (même principe de détection que PREMIER_ACHAT en Phase 4),
 * récompense en points aux deux. Saisie du code parrain scopée à la création
 * client côté admin pour cette phase.
 */

const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Génère un code de parrainage lisible et unique (retry sur collision). */
export async function genererCodeParrainage(tx: TxClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `PAR-${randomSuffix()}`;
    const existant = await tx.client.findUnique({ where: { codeParrainage: code }, select: { id: true } });
    if (!existant) return code;
  }
  throw new Error("Impossible de générer un code de parrainage unique, réessayez");
}

/** Charge (et crée au besoin) le paramétrage singleton du programme de parrainage. */
export async function chargerParametrageParrainage() {
  const existant = await prisma.parametrageParrainage.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.parametrageParrainage.create({ data: { id: 1 } });
}

/**
 * À la création d'un client (§84) : si un code de parrain est fourni, résout
 * le Client parrain correspondant et crée le Parrainage (EN_ATTENTE). Ne fait
 * rien si le code est invalide/inconnu (n'empêche pas la création du client).
 */
export async function creerParrainageSiCode(
  tx: TxClient,
  opts: { filleulId: number; codeParrainageUtilise?: string | null },
) {
  const code = opts.codeParrainageUtilise?.trim().toUpperCase();
  if (!code) return null;

  let param = await tx.parametrageParrainage.findUnique({ where: { id: 1 } });
  if (!param) param = await tx.parametrageParrainage.create({ data: { id: 1 } });
  if (!param.actif) return null;

  const parrain = await tx.client.findUnique({ where: { codeParrainage: code }, select: { id: true } });
  if (!parrain || parrain.id === opts.filleulId) return null;

  return tx.parrainage.create({
    data: { parrainId: parrain.id, filleulId: opts.filleulId, statut: "EN_ATTENTE" },
  });
}

export interface ResultatParrainages {
  parrainagesEvalues: number;
  qualifies: number;
}

/**
 * Pour chaque Parrainage EN_ATTENTE : vérifie si le filleul a un premier achat
 * (VenteDirecte valide) → passe QUALIFIE → attribue les points aux deux
 * (parrain + filleul) → passe RECOMPENSE.
 */
export async function evaluerParrainagesQualifies(): Promise<ResultatParrainages> {
  const enAttente = await prisma.parrainage.findMany({ where: { statut: "EN_ATTENTE" } });
  if (!enAttente.length) return { parrainagesEvalues: 0, qualifies: 0 };

  const param = await chargerParametrageParrainage();
  let qualifies = 0;

  for (const parrainage of enAttente) {
    const premierAchat = await prisma.venteDirecte.findFirst({
      where: { clientId: parrainage.filleulId, statut: { notIn: VENTES_EXCLUES as never } },
      select: { id: true },
    });
    if (!premierAchat) continue;

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.parrainage.update({
        where: { id: parrainage.id },
        data: { statut: "QUALIFIE", dateQualification: now },
      });

      if (param.actif) {
        await attribuerPointsFidelite(tx, {
          clientId: parrainage.parrainId, points: param.pointsParrain, type: "BONUS",
          motif: "Parrainage — filleul qualifié", source: "PARRAINAGE",
        });
        await attribuerPointsFidelite(tx, {
          clientId: parrainage.filleulId, points: param.pointsFilleul, type: "BONUS",
          motif: "Parrainage — premier achat", source: "PARRAINAGE",
        });
      }

      await tx.parrainage.update({
        where: { id: parrainage.id },
        data: { statut: "RECOMPENSE", dateRecompense: now },
      });
    });
    qualifies += 1;
  }

  return { parrainagesEvalues: enAttente.length, qualifies };
}
