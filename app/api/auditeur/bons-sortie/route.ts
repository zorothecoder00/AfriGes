import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

export async function GET(req: Request) {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut");
    const type   = searchParams.get("type");

    const where: Prisma.BonSortieWhereInput = {
      ...(statut && { statut: statut as Prisma.EnumStatutBonSortieFilter }),
      ...(type   && { typeSortie: type as Prisma.EnumTypeSortieStockFilter }),
    };

    const [bons, total] = await Promise.all([
      prisma.bonSortie.findMany({
        where,
        include: {
          creePar: { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.bonSortie.count({ where }),
    ]);

    return NextResponse.json({
      data: bons,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
