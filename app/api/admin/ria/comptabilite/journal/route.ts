import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { RIA_REF_PREFIX } from "@/lib/riaComptable";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const page    = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit   = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const skip    = (page - 1) * limit;
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");
    const type    = searchParams.get("type"); // DEP, RET, FIN, REM, DIST

    const where: Prisma.EcritureComptableWhereInput = {
      reference: { startsWith: type ? `RIA-${type}` : RIA_REF_PREFIX },
      ...(dateMin || dateMax
        ? { date: { ...(dateMin ? { gte: new Date(dateMin) } : {}), ...(dateMax ? { lte: new Date(dateMax + "T23:59:59") } : {}) } }
        : {}),
    };

    const [ecritures, total] = await Promise.all([
      prisma.ecritureComptable.findMany({
        where,
        include: {
          lignes: {
            include: { compte: { select: { id: true, numero: true, libelle: true } } },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.ecritureComptable.count({ where }),
    ]);

    const totaux = await prisma.ligneEcriture.aggregate({
      where: { ecriture: where },
      _sum: { debit: true, credit: true },
    });

    return NextResponse.json({
      data:   ecritures,
      totaux: { debit: Number(totaux._sum.debit ?? 0), credit: Number(totaux._sum.credit ?? 0) },
      meta:   { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
