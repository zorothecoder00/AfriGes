import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";

/**
 * GET /api/caissier/session
 * Retourne la session active (OUVERTE ou SUSPENDUE) ou null.
 */
export async function GET() {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: { statut: { in: ["OUVERTE", "SUSPENDUE"] } },
      orderBy: { createdAt: "desc" },
    });

    if (!sessionActive) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...sessionActive,
        fondsCaisse:   Number(sessionActive.fondsCaisse),
        dateOuverture: sessionActive.dateOuverture.toISOString(),
        dateFermeture: sessionActive.dateFermeture?.toISOString() ?? null,
        createdAt:     sessionActive.createdAt.toISOString(),
        updatedAt:     sessionActive.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/session error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/caissier/session
 * Ouvre une nouvelle session de caisse.
 * Body: { fondsCaisse: number, notes?: string }
 * 409 si une session OUVERTE existe déjà.
 */
export async function POST(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const fondsCaisse = Number(body.fondsCaisse ?? 0);
    if (isNaN(fondsCaisse) || fondsCaisse < 0) {
      return NextResponse.json({ message: "Fonds de caisse invalide" }, { status: 400 });
    }
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

    // Vérifier qu'il n'y a pas de session OUVERTE
    const existing = await prisma.sessionCaisse.findFirst({
      where: { statut: "OUVERTE" },
    });
    if (existing) {
      return NextResponse.json({ message: "Une session est déjà ouverte" }, { status: 409 });
    }

    const caissierNom = auth.user.name ?? `${auth.user.prenom} ${auth.user.nom}`;
    const caissierId  = parseInt(auth.user.id);

    const newSession = await prisma.sessionCaisse.create({
      data: {
        caissierNom,
        caissierId,
        fondsCaisse: new Prisma.Decimal(fondsCaisse),
        statut:      "OUVERTE",
        notes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Session de caisse ouverte",
        data: {
          ...newSession,
          fondsCaisse:   Number(newSession.fondsCaisse),
          dateOuverture: newSession.dateOuverture.toISOString(),
          createdAt:     newSession.createdAt.toISOString(),
          updatedAt:     newSession.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/caissier/session error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
