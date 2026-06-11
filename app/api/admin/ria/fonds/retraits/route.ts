import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

function refRetrait(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `RET-${d}-${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const statut         = searchParams.get("statut");
    const portefeuilleId = searchParams.get("portefeuilleId");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)         where.statut         = statut;
    if (portefeuilleId) where.portefeuilleId = parseInt(portefeuilleId);

    const [retraits, total] = await Promise.all([
      prisma.retraitInvestisseur.findMany({
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
      prisma.retraitInvestisseur.count({ where }),
    ]);

    return NextResponse.json({
      data: retraits,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/fonds/retraits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { portefeuilleId, montant, motif, modePaiement, notes } = await req.json();

    if (!portefeuilleId || !montant || Number(montant) <= 0) {
      return NextResponse.json({ error: "portefeuilleId et montant (> 0) sont obligatoires" }, { status: 400 });
    }

    const pf = await prisma.portefeuilleRIA.findUnique({ where: { id: parseInt(portefeuilleId) } });
    if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });
    if (Number(pf.capitalDisponible) < Number(montant)) {
      return NextResponse.json({ error: "Capital disponible insuffisant" }, { status: 400 });
    }

    const retrait = await prisma.retraitInvestisseur.create({
      data: {
        reference: refRetrait(),
        portefeuilleId: parseInt(portefeuilleId),
        montant: Number(montant),
        motif: motif ?? null,
        modePaiement: modePaiement ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ data: retrait }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/fonds/retraits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
