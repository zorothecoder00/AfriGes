import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const rapport = await prisma.rapportMensuelRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        portefeuille: {
          select: {
            id: true, reference: true, nom: true,
            profilRIA: {
              select: {
                numero: true,
                gestionnaire: {
                  select: { member: { select: { nom: true, prenom: true, email: true, telephone: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!rapport) return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });

    return NextResponse.json({ data: { ...rapport, donnees: rapport.donnees } });
  } catch (error) {
    console.error("GET /api/admin/ria/rapports/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
