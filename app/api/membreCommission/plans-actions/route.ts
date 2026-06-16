import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

// Plans d'action assignés au membre connecté
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const now = new Date();

    const plans = await prisma.planActionCommRIA.findMany({
      where: {
        responsableId: userId,
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        resolution: { select: { id: true, numero: true, titre: true } },
      },
      orderBy: [{ dateEcheance: "asc" }],
    });

    const enriched = plans.map((p) => ({
      ...p,
      enRetard: p.dateEcheance && new Date(p.dateEcheance) < now
        && !["TERMINE", "REALISE", "ABANDONNE"].includes(p.statut),
    }));

    return NextResponse.json({ plans: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
