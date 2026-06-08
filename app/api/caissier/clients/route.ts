import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

/**
 * GET /api/caissier/clients
 * Recherche de clients rattachés au PDV du caissier.
 * Query: search, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    const searchWhere: Prisma.ClientWhereInput = search
      ? (() => {
          const parts = search.split(/\s+/);
          const conditions: Prisma.ClientWhereInput[] = [
            { nom:       { contains: search, mode: "insensitive" } },
            { prenom:    { contains: search, mode: "insensitive" } },
            { telephone: { contains: search, mode: "insensitive" } },
          ];
          if (parts.length >= 2) {
            const [first, ...rest] = parts;
            const restStr = rest.join(" ");
            conditions.push({
              AND: [
                { prenom: { contains: first,   mode: "insensitive" } },
                { nom:    { contains: restStr, mode: "insensitive" } },
              ],
            });
            conditions.push({
              AND: [
                { nom:    { contains: first,   mode: "insensitive" } },
                { prenom: { contains: restStr, mode: "insensitive" } },
              ],
            });
          }
          return { OR: conditions };
        })()
      : {};

    const where: Prisma.ClientWhereInput = {
      ...(pdvId
        ? {
            OR: [
              { pointDeVenteId: pdvId },
              { pointsDeVente: { some: { pointDeVenteId: pdvId } } },
            ],
          }
        : {}),
      ...searchWhere,
    };

    const clients = await prisma.client.findMany({
      where,
      take: limit,
      orderBy: { nom: "asc" },
      select: {
        id:        true,
        nom:       true,
        prenom:    true,
        telephone: true,
        adresse:   true,
        segment:   true,
        tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
      },
    });

    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    console.error("GET /api/caissier/clients", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
