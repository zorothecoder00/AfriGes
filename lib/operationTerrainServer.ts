import { Prisma, TypeOperationTerrain } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TYPES_OPERATION_TERRAIN } from "@/lib/operationTerrain";

/**
 * Validation d'une opération terrain (CDC §41) — SERVEUR uniquement (accès
 * DB). Séparé de lib/operationTerrain.ts (pur/client-safe) car ce module
 * importe Prisma.
 */

type OperationTerrainData = {
  campagneId: number;
  type: TypeOperationTerrain;
  zone: string;
  pointDeVenteId: number | null;
  dateDebut: Date;
  dateFin: Date;
  budget: Prisma.Decimal;
  objectifsText: string | null;
  equipeIds: number[];
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function validerOperationTerrain(
  body: Record<string, unknown>,
): Promise<{ error: string; status: number } | { data: OperationTerrainData }> {
  const campagneId = num(body.campagneId);
  if (!campagneId) return { error: "La campagne est requise", status: 400 };
  const campagne = await prisma.campagne.findUnique({ where: { id: campagneId }, select: { id: true } });
  if (!campagne) return { error: "Campagne introuvable", status: 404 };

  const type = body.type as TypeOperationTerrain;
  if (!TYPES_OPERATION_TERRAIN.includes(type)) return { error: "Type d'opération invalide", status: 400 };

  const zone = typeof body.zone === "string" ? body.zone.trim() : "";
  if (!zone) return { error: "La zone est requise", status: 400 };

  const dateDebut = body.dateDebut ? new Date(body.dateDebut as string) : null;
  const dateFin = body.dateFin ? new Date(body.dateFin as string) : null;
  if (!dateDebut || isNaN(dateDebut.getTime())) return { error: "Date de début invalide", status: 400 };
  if (!dateFin || isNaN(dateFin.getTime())) return { error: "Date de fin invalide", status: 400 };
  if (dateFin < dateDebut) return { error: "La date de fin doit être postérieure à la date de début", status: 400 };

  const pointDeVenteId = num(body.pointDeVenteId);
  if (pointDeVenteId && !(await prisma.pointDeVente.findUnique({ where: { id: pointDeVenteId }, select: { id: true } }))) {
    return { error: "Agence introuvable", status: 404 };
  }

  const equipeIds = Array.isArray(body.equipeIds)
    ? [...new Set((body.equipeIds as unknown[]).map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))]
    : [];
  if (equipeIds.length) {
    const count = await prisma.user.count({ where: { id: { in: equipeIds } } });
    if (count !== equipeIds.length) return { error: "Un ou plusieurs membres de l'équipe sont introuvables", status: 404 };
  }

  return {
    data: {
      campagneId, type, zone, pointDeVenteId,
      dateDebut, dateFin,
      budget: new Prisma.Decimal(num(body.budget) ?? 0),
      objectifsText: typeof body.objectifsText === "string" && body.objectifsText.trim() ? body.objectifsText.trim() : null,
      equipeIds,
    },
  };
}
