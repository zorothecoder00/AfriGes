import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");

    // Récupérer les commissions du membre
    const memberships = await prisma.membreCommissionRIA.findMany({
      where: { userId, actif: true },
      select: { typeCommission: true, id: true },
    });
    const types = memberships.map((m) => m.typeCommission);

    const reunions = await prisma.reunionCommissionRIA.findMany({
      where: {
        typeCommission: { in: types },
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        organisateur: { select: { id: true, nom: true, prenom: true } },
        presences: {
          where: { membreId: { in: memberships.map((m) => m.id) } },
          select: { present: true, signatureNumerique: true, dateSignature: true },
        },
        compteRenduStr: { select: { id: true, dateValidation: true } },
        _count: { select: { resolutions: true } },
      },
      orderBy: { dateHeure: "desc" },
      take: 50,
    });

    return NextResponse.json({ reunions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
