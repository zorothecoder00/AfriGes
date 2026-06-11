import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const portefeuille = await prisma.portefeuilleRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        profilRIA: {
          include: {
            gestionnaire: {
              include: { member: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } } },
            },
          },
        },
        depots:    { orderBy: { createdAt: "desc" }, take: 20 },
        retraits:  { orderBy: { createdAt: "desc" }, take: 20 },
        mouvements: { orderBy: { createdAt: "desc" }, take: 50 },
        financements: {
          orderBy: { dateFinancement: "desc" },
          take: 20,
          include: { client: { select: { id: true, nom: true, prenom: true, telephone: true } } },
        },
        distributions: { orderBy: [{ annee: "desc" }, { mois: "desc" }], take: 12 },
      },
    });

    if (!portefeuille) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });

    return NextResponse.json({ data: portefeuille });
  } catch (error) {
    console.error("GET /api/admin/ria/portefeuilles/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { nom, notes, actif } = await req.json();

    const portefeuille = await prisma.portefeuilleRIA.update({
      where: { id: parseInt(id) },
      data: {
        ...(nom   !== undefined ? { nom }   : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(actif !== undefined ? { actif } : {}),
      },
    });

    return NextResponse.json({ data: portefeuille });
  } catch (error) {
    console.error("PATCH /api/admin/ria/portefeuilles/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
