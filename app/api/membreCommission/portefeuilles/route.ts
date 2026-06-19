import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

// Liste (lecture) des portefeuilles RIA pour les membres de commission — utilisée
// par le sélecteur « Investisseurs concernés » d'une demande de financement.
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

    const data = await prisma.portefeuilleRIA.findMany({
      where: { actif: true },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, reference: true, nom: true,
        profilRIA: {
          select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } },
        },
      },
    });

    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
