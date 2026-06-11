import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const profilRIAId = searchParams.get("profilRIAId");
    const actif       = searchParams.get("actif");
    const page        = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit       = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip        = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRIAId) where.profilRIAId = parseInt(profilRIAId);
    if (actif !== null) where.actif = actif !== "false";

    const [portefeuilles, total] = await Promise.all([
      prisma.portefeuilleRIA.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profilRIA: {
            include: {
              gestionnaire: {
                include: { member: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } } },
              },
            },
          },
          _count: { select: { depots: true, retraits: true, financements: true } },
        },
      }),
      prisma.portefeuilleRIA.count({ where }),
    ]);

    return NextResponse.json({
      data: portefeuilles,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/portefeuilles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { profilRIAId, nom, notes } = await req.json();
    if (!profilRIAId) return NextResponse.json({ error: "profilRIAId est obligatoire" }, { status: 400 });

    const profil = await prisma.profilInvestisseurRIA.findUnique({ where: { id: parseInt(profilRIAId) } });
    if (!profil) return NextResponse.json({ error: "Profil investisseur introuvable" }, { status: 404 });

    const count = await prisma.portefeuilleRIA.count();
    const portefeuille = await prisma.portefeuilleRIA.create({
      data: {
        reference: `PF-${String(count + 1).padStart(5, "0")}`,
        profilRIAId: parseInt(profilRIAId),
        nom: nom ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ data: portefeuille }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/portefeuilles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
