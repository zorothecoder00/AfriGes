import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

export async function GET(req: Request) {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit    = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip     = (page - 1) * limit;
    const type     = searchParams.get("type");
    const produitId = searchParams.get("produitId");
    const search   = searchParams.get("search") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(type && { type }),
      ...(produitId && { produitId: Number(produitId) }),
      ...(search && {
        OR: [
          { motif:     { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { produit: { nom: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [mouvements, total] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        include: { produit: { select: { id: true, nom: true } } },
        orderBy: { dateMouvement: "desc" },
        skip,
        take: limit,
      }),
      prisma.mouvementStock.count({ where }),
    ]);

    const stats = await prisma.mouvementStock.groupBy({
      by: ["type"],
      _count: true,
    });

    return NextResponse.json({
      data: mouvements,
      stats: Object.fromEntries(stats.map((s) => [s.type, s._count])),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
