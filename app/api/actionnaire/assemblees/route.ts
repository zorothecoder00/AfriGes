import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

export async function GET() {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const userId = parseInt(session.user.id);

    // Récupérer le gestionnaire lié à cet utilisateur
    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
    });

    const assemblees = await prisma.assemblee.findMany({
      orderBy: { dateAssemblee: "desc" },
      include: {
        resolutions: {
          orderBy: { numero: "asc" },
          include: {
            votes: gestionnaire
              ? { where: { participant: { gestionnaireId: gestionnaire.id } } }
              : false,
          },
        },
        participants: gestionnaire
          ? { where: { gestionnaireId: gestionnaire.id } }
          : false,
        _count: { select: { participants: true } },
      },
    });

    return NextResponse.json({ data: assemblees, gestionnaireId: gestionnaire?.id ?? null });
  } catch (error) {
    console.error("GET /api/actionnaire/assemblees", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
