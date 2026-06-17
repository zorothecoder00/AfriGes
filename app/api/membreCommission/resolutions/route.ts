import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

// Résolutions des commissions du membre connecté (lecture seule).
// Admin / RESPONSABLE_RIA (auth.commission === null) voient toutes les commissions.
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");

    const isAdmin = auth.commission === null;
    let typeFilter = {};
    if (!isAdmin) {
      const memberships = await prisma.membreCommissionRIA.findMany({
        where: { userId, actif: true },
        select: { typeCommission: true },
      });
      typeFilter = { typeCommission: { in: memberships.map((m) => m.typeCommission) } };
    }

    const resolutions = await prisma.resolutionCommRIA.findMany({
      where: {
        ...typeFilter,
        ...(statut ? { statut: statut as never } : {}),
      },
      include: {
        reunion: { select: { id: true, titre: true, dateHeure: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: { select: { id: true, statut: true, progression: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ resolutions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
