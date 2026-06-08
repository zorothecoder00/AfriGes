import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/remboursements
 * Vue agrégée de tous les versements packs (remboursements de créances)
 * Query params: page, limit, search, agentId, pdvId, dateDebut, dateFin, type
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Number(searchParams.get("page")  || 1);
    const limit     = Number(searchParams.get("limit") || 20);
    const skip      = (page - 1) * limit;
    const search    = (searchParams.get("search")    || "").trim();
    const agentId   = searchParams.get("agentId");
    const pdvId     = searchParams.get("pdvId");
    const dateDebut = searchParams.get("dateDebut");
    const dateFin   = searchParams.get("dateFin");
    const type      = searchParams.get("type"); // TypeVersement

    const where: Prisma.VersementPackWhereInput = {
      statut: "PAYE",
      ...(type && { type: type as never }),
      ...(dateDebut || dateFin
        ? {
            datePaiement: {
              ...(dateDebut && { gte: new Date(dateDebut) }),
              ...(dateFin   && { lte: new Date(dateFin + "T23:59:59") }),
            },
          }
        : {}),
      ...(search || agentId || pdvId
        ? {
            souscription: {
              client: {
                ...(agentId && { agentTerrainId: Number(agentId) }),
                ...(pdvId   && { pointDeVenteId: Number(pdvId) }),
                ...(search  && {
                  OR: [
                    { nom:       { contains: search, mode: "insensitive" } },
                    { prenom:    { contains: search, mode: "insensitive" } },
                    { telephone: { contains: search, mode: "insensitive" } },
                    { codeClient:{ contains: search, mode: "insensitive" } },
                  ],
                }),
              },
            },
          }
        : {}),
    };

    const [versements, total, stats] = await Promise.all([
      prisma.versementPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { datePaiement: "desc" },
        include: {
          souscription: {
            select: {
              id: true,
              montantTotal: true,
              montantVerse: true,
              montantRestant: true,
              statut: true,
              pack: { select: { id: true, nom: true, type: true } },
              client: {
                select: {
                  id: true, nom: true, prenom: true, telephone: true, codeClient: true,
                  segment: true,
                  agentTerrain: { select: { id: true, nom: true, prenom: true } },
                  pointDeVente: { select: { id: true, nom: true, code: true } },
                  tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
                },
              },
            },
          },
          ligneCollecte: {
            select: {
              collecteId: true,
              collecte: { select: { reference: true, dateCollecte: true } },
            },
          },
        },
      }),
      prisma.versementPack.count({ where }),
      prisma.versementPack.aggregate({
        where,
        _sum: { montant: true },
        _count: { id: true },
      }),
    ]);

    // Stats par type de versement
    const statsByType = await prisma.versementPack.groupBy({
      by: ["type"],
      where,
      _sum:   { montant: true },
      _count: { id: true },
    });

    return NextResponse.json({
      data: versements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats: {
        totalVersements:  Number(stats._sum.montant ?? 0),
        nombreVersements: stats._count.id,
        parType: statsByType.map((s) => ({
          type:    s.type,
          montant: Number(s._sum.montant ?? 0),
          nombre:  s._count.id,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/remboursements", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
