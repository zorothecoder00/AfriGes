import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { TypeCommissionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ type: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { type } = await params;
    const typeCommission = type.toUpperCase() as TypeCommissionRIA;

    const [membres, reunions, resolutions, plansAction, observations] = await Promise.all([
      prisma.membreCommissionRIA.findMany({
        where: { typeCommission },
        include: { user: { select: { id: true, nom: true, prenom: true } } },
        orderBy: [{ role: "asc" }, { dateEntree: "desc" }],
      }),
      prisma.reunionCommissionRIA.findMany({
        where: { typeCommission },
        include: {
          _count: { select: { presences: true, resolutions: true } },
        },
        orderBy: { dateHeure: "desc" },
        take: 20,
      }),
      prisma.resolutionCommRIA.findMany({
        where: { typeCommission },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.planActionCommRIA.findMany({
        where: { typeCommission },
        include: {
          responsable: { select: { id: true, nom: true, prenom: true } },
          resolution: { select: { id: true, numero: true, titre: true } },
        },
        orderBy: [{ dateEcheance: "asc" }],
        take: 30,
      }),
      prisma.observationCommissionRIA.findMany({
        where: { typeCommission },
        include: {
          auteur: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: [{ epingle: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
    ]);

    const now = new Date();
    const enrichedPlans = plansAction.map(p => ({
      ...p,
      enRetard: !!p.dateEcheance && new Date(p.dateEcheance) < now
        && !["TERMINE", "REALISE", "ABANDONNE"].includes(p.statut),
    }));

    return NextResponse.json({
      membres,
      reunions,
      resolutions,
      plansAction: enrichedPlans,
      observations,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
