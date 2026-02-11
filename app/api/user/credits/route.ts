import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/user/credits
 * Liste les credits de l'utilisateur connecte avec stats
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const memberId = Number(session.user.id);

    const credits = await prisma.credit.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    // Statistiques
    const totalEmprunte = credits.reduce((sum, c) => sum + Number(c.montant), 0);
    const totalRestant = credits.reduce((sum, c) => sum + Number(c.montantRestant), 0);
    const creditsActifs = credits.filter((c) =>
      ["EN_ATTENTE", "APPROUVE", "REMBOURSE_PARTIEL"].includes(c.statut)
    ).length;

    return NextResponse.json({
      data: credits,
      stats: {
        totalEmprunte,
        totalRestant,
        creditsActifs,
      },
    });
  } catch (error) {
    console.error("GET /user/credits error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des credits" },
      { status: 500 }
    );
  }
}
