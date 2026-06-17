import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

// Flux automatique reçu par la Commission Optimisation : rapports Finance/Audit/Terrain
export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const rapports = await prisma.rapportCommissionRIA.findMany({
      where: { typeCommission: { in: ["FINANCE", "AUDIT", "OPERATIONS_TERRAIN"] } },
      select: {
        id: true, titre: true, type: true, typeCommission: true, statut: true, periode: true, createdAt: true,
        redacteur: { select: { nom: true, prenom: true } },
        _count: { select: { analysesOptimisation: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ rapports });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
