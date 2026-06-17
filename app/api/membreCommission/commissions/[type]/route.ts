import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import { TypeCommissionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ type: string }> };

// Détail d'une commission pour un membre : roster + réunions, résolutions,
// plans d'action et observations récents. Accès réservé aux membres de la
// commission (admin / RESPONSABLE_RIA voient tout via auth.commission === null).
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { type } = await params;
    const typeCommission = type as TypeCommissionRIA;
    if (!Object.values(TypeCommissionRIA).includes(typeCommission)) {
      return NextResponse.json({ error: "Type de commission invalide" }, { status: 400 });
    }

    const userId = parseInt(auth.session.user.id);
    const isAdmin = auth.commission === null;

    const moi = await prisma.membreCommissionRIA.findUnique({
      where: { typeCommission_userId: { typeCommission, userId } },
      select: { role: true, actif: true },
    });

    if (!isAdmin && !(moi?.actif)) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette commission" }, { status: 403 });
    }

    const [membres, reunions, resolutions, plansAction, observations] = await Promise.all([
      prisma.membreCommissionRIA.findMany({
        where: { typeCommission, actif: true },
        include: { user: { select: { id: true, nom: true, prenom: true, photo: true } } },
        orderBy: { role: "asc" },
      }),
      prisma.reunionCommissionRIA.findMany({
        where: { typeCommission },
        select: { id: true, titre: true, dateHeure: true, statut: true, _count: { select: { resolutions: true } } },
        orderBy: { dateHeure: "desc" },
        take: 10,
      }),
      prisma.resolutionCommRIA.findMany({
        where: { typeCommission },
        select: { id: true, numero: true, titre: true, statut: true, dateEcheance: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.planActionCommRIA.findMany({
        where: { typeCommission },
        select: {
          id: true, titre: true, statut: true, progression: true, dateEcheance: true, priorite: true,
          responsable: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateEcheance: "asc" },
        take: 10,
      }),
      prisma.observationCommissionRIA.findMany({
        where: { typeCommission },
        include: { auteur: { select: { id: true, nom: true, prenom: true } } },
        orderBy: [{ epingle: "desc" }, { createdAt: "desc" }],
        take: 8,
      }),
    ]);

    return NextResponse.json({
      typeCommission,
      monRole: moi?.role ?? null,
      membres,
      reunions,
      resolutions,
      plansAction,
      observations,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
