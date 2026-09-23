import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

const STATUTS = ["EN_COURS", "SOUMIS", "VALIDE", "ANNULE"] as const;

/**
 * GET /api/admin/stock/inventaires
 * Inventaires physiques de tous les PDV (validation admin des inventaires soumis).
 * Query: statut, pointDeVenteId, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";
    const pdvId  = Number(searchParams.get("pointDeVenteId") || 0);

    const where: Prisma.InventaireSiteWhereInput = {};
    if ((STATUTS as readonly string[]).includes(statut)) where.statut = statut as (typeof STATUTS)[number];
    if (pdvId) where.pointDeVenteId = pdvId;

    const [inventaires, total, parStatut] = await Promise.all([
      prisma.inventaireSite.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dateSoumission: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          realisePar:   { select: { id: true, nom: true, prenom: true } },
          validePar:    { select: { id: true, nom: true, prenom: true } },
          _count: { select: { lignes: true } },
          lignes: { where: { ecart: { not: 0 } }, select: { id: true } },
        },
      }),
      prisma.inventaireSite.count({ where }),
      prisma.inventaireSite.groupBy({
        by: ["statut"],
        where: pdvId ? { pointDeVenteId: pdvId } : {},
        _count: { _all: true },
      }),
    ]);

    const stats = Object.fromEntries(STATUTS.map(s => [s, parStatut.find(p => p.statut === s)?._count._all ?? 0]));

    return NextResponse.json({
      data: inventaires.map(({ lignes, ...i }) => ({ ...i, nbEcarts: lignes.length })),
      stats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/stock/inventaires:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
