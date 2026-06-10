import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const portefeuilleId = searchParams.get("portefeuilleId");
    const type           = searchParams.get("type");
    const sens           = searchParams.get("sens");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (portefeuilleId) where.portefeuilleId = parseInt(portefeuilleId);
    if (type)           where.type           = type;
    if (sens)           where.sens           = sens;

    const [mouvements, total] = await Promise.all([
      prisma.mouvementFondsRIA.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          portefeuille: {
            include: {
              profilRIA: {
                include: {
                  gestionnaire: { include: { member: { select: { id: true, nom: true, prenom: true } } } },
                },
              },
            },
          },
        },
      }),
      prisma.mouvementFondsRIA.count({ where }),
    ]);

    return NextResponse.json({
      data: mouvements,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/fonds/mouvements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
