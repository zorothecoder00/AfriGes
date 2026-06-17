import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

// Indique si l'utilisateur courant a un accès investisseur (profilRIA présent
// ou rôle INVESTISSEUR_RIA). Utilisé par le raccourci flottant.
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ estInvestisseur: false });

    if (session.user.gestionnaireRole === "INVESTISSEUR_RIA") {
      return NextResponse.json({ estInvestisseur: true });
    }

    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { memberId: parseInt(session.user.id), profilRIA: { isNot: null } },
      select: { id: true },
    });
    return NextResponse.json({ estInvestisseur: !!gestionnaire });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ estInvestisseur: false });
  }
}
