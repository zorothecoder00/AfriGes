import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvestisseurRIASession } from "@/lib/authInvestisseurRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getInvestisseurRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(session.user.id!);

    const gestionnaire = await prisma.gestionnaire.findUnique({ where: { memberId: userId } });
    if (!gestionnaire) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const profil = await prisma.profilInvestisseurRIA.findUnique({ where: { gestionnaireId: gestionnaire.id } });
    if (!profil) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pfIds = (await prisma.portefeuilleRIA.findMany({
      where: { profilRIAId: profil.id }, select: { id: true },
    })).map((p) => p.id);

    const rapport = await prisma.rapportMensuelRIA.findUnique({
      where: { id: parseInt(id) },
      include: { portefeuille: { select: { id: true, reference: true, nom: true } } },
    });

    if (!rapport || !pfIds.includes(rapport.portefeuilleId)) {
      return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: rapport });
  } catch (error) {
    console.error("GET /api/investisseurRIA/rapports/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
