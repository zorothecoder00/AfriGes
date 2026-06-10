import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvestisseurRIASession } from "@/lib/authInvestisseurRIA";

export async function GET() {
  const session = await getInvestisseurRIASession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = Number(session.user.id);

  const gestionnaire = await prisma.gestionnaire.findUnique({
    where: { memberId: userId },
    select: { id: true, profilRIA: { select: { id: true } } },
  });
  if (!gestionnaire?.profilRIA) {
    return NextResponse.json({ data: [] });
  }

  const portefeuilles = await prisma.portefeuilleRIA.findMany({
    where: { profilRIAId: gestionnaire.profilRIA.id },
    include: {
      _count: { select: { mouvements: true, financements: true, affectations: true, distributions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: portefeuilles });
}
