import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvestisseurRIASession } from "@/lib/authInvestisseurRIA";

export async function GET(req: NextRequest) {
  const session = await getInvestisseurRIASession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = Number(session.user.id);
  const { searchParams } = new URL(req.url);
  const type   = searchParams.get("type")   ?? undefined;
  const sens   = searchParams.get("sens")   ?? undefined;
  const pfId   = searchParams.get("pfId")   ? Number(searchParams.get("pfId")) : undefined;
  const limit  = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  const gestionnaire = await prisma.gestionnaire.findUnique({
    where: { memberId: userId },
    select: { id: true, profilRIA: { select: { id: true, portefeuilles: { select: { id: true } } } } },
  });
  if (!gestionnaire?.profilRIA) return NextResponse.json({ data: [] });

  const portefeuilleIds = gestionnaire.profilRIA.portefeuilles.map((p) => p.id);

  const mouvements = await prisma.mouvementFondsRIA.findMany({
    where: {
      portefeuilleId: pfId ? pfId : { in: portefeuilleIds },
      ...(type && { type: type as never }),
      ...(sens && { sens: sens as never }),
    },
    include: {
      portefeuille: { select: { id: true, reference: true, nom: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ data: mouvements });
}
