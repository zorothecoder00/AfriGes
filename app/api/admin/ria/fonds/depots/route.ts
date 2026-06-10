import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

function refDepot(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `DEP-${d}-${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const statut       = searchParams.get("statut");
    const portefeuilleId = searchParams.get("portefeuilleId");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)        where.statut         = statut;
    if (portefeuilleId) where.portefeuilleId = parseInt(portefeuilleId);

    const [depots, total] = await Promise.all([
      prisma.depotInvestisseur.findMany({
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
      prisma.depotInvestisseur.count({ where }),
    ]);

    return NextResponse.json({
      data: depots,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/fonds/depots", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { portefeuilleId, montant, modePaiement, justificatifUrl, notes } = await req.json();

    if (!portefeuilleId || !montant || Number(montant) <= 0) {
      return NextResponse.json({ error: "portefeuilleId et montant (> 0) sont obligatoires" }, { status: 400 });
    }

    const pf = await prisma.portefeuilleRIA.findUnique({ where: { id: parseInt(portefeuilleId) } });
    if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });

    const depot = await prisma.depotInvestisseur.create({
      data: {
        reference: refDepot(),
        portefeuilleId: parseInt(portefeuilleId),
        montant: Number(montant),
        modePaiement: modePaiement ?? null,
        justificatifUrl: justificatifUrl ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ data: depot }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/fonds/depots", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
