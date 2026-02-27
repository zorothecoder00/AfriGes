import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/caissier/session/[id]
 * Body: { action: "SUSPENDRE" | "ROUVRIR" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (!["SUSPENDRE", "ROUVRIR"].includes(action)) {
      return NextResponse.json({ message: "Action invalide (SUSPENDRE | ROUVRIR)" }, { status: 400 });
    }

    const sessionCaisse = await prisma.sessionCaisse.findUnique({ where: { id: sessionId } });
    if (!sessionCaisse) {
      return NextResponse.json({ message: "Session introuvable" }, { status: 404 });
    }

    if (action === "SUSPENDRE" && sessionCaisse.statut !== "OUVERTE") {
      return NextResponse.json({ message: "La session n'est pas ouverte" }, { status: 409 });
    }
    if (action === "ROUVRIR" && sessionCaisse.statut !== "SUSPENDUE") {
      return NextResponse.json({ message: "La session n'est pas suspendue" }, { status: 409 });
    }

    const newStatut = action === "SUSPENDRE" ? "SUSPENDUE" : "OUVERTE";
    const updated = await prisma.sessionCaisse.update({
      where: { id: sessionId },
      data:  { statut: newStatut },
    });

    return NextResponse.json({
      success: true,
      message: action === "SUSPENDRE" ? "Session suspendue" : "Session reprise",
      data: {
        ...updated,
        fondsCaisse:   Number(updated.fondsCaisse),
        dateOuverture: updated.dateOuverture.toISOString(),
        dateFermeture: updated.dateFermeture?.toISOString() ?? null,
        createdAt:     updated.createdAt.toISOString(),
        updatedAt:     updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/caissier/session/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
