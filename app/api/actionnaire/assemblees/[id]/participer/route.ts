import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);
    if (isNaN(assembleeId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
    });
    if (!gestionnaire) {
      return NextResponse.json({ error: "Profil gestionnaire introuvable" }, { status: 404 });
    }

    const assemblee = await prisma.assemblee.findUnique({ where: { id: assembleeId } });
    if (!assemblee) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }
    if (assemblee.statut === "TERMINEE" || assemblee.statut === "ANNULEE") {
      return NextResponse.json({ error: "Cette assemblée est terminée ou annulée" }, { status: 400 });
    }

    const participant = await prisma.assembleeParticipant.upsert({
      where: {
        assembleeId_gestionnaireId: {
          assembleeId,
          gestionnaireId: gestionnaire.id,
        },
      },
      update: {
        statut: "CONFIRME",
        dateConfirmation: new Date(),
      },
      create: {
        assembleeId,
        gestionnaireId: gestionnaire.id,
        statut: "CONFIRME",
        dateConfirmation: new Date(),
      },
    });

    return NextResponse.json({ data: participant });
  } catch (error) {
    console.error("POST /api/actionnaire/assemblees/[id]/participer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
