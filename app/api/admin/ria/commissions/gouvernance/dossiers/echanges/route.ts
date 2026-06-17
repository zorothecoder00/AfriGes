import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA, TypeEchangeIC } from "@prisma/client";

// Historique global des échanges inter-commissions, tous dossiers confondus
export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const commission = searchParams.get("commission");
    const type        = searchParams.get("type");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

    const where = {
      ...(commission ? { commission: commission as TypeCommissionRIA } : {}),
      ...(type        ? { type: type as TypeEchangeIC }                 : {}),
    };

    const [echanges, total] = await Promise.all([
      prisma.echangeInterCommission.findMany({
        where,
        include: {
          auteur: { select: { id: true, nom: true, prenom: true } },
          dossier: { select: { id: true, reference: true, titre: true, statut: true, commissionEmettrice: true, commissionReceptrice: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.echangeInterCommission.count({ where }),
    ]);

    return NextResponse.json({ data: echanges, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
