import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionLivraison } from "@/lib/tourneeLivraison";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/logistique/tournees/[id] */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const tournee = await prisma.tourneeLivraison.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!tournee) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });

    return NextResponse.json({ data: tournee });
  } catch (error) {
    console.error("GET /logistique/tournees/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/tournees/[id]
 * Body: { action: "DEMARRER" | "TERMINER" | "ANNULER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const tourneeId = Number(id);
    const tournee = await prisma.tourneeLivraison.findUnique({ where: { id: tourneeId } });
    if (!tournee) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });

    const body = await req.json();
    const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
      DEMARRER: { from: ["PLANIFIEE"], to: "EN_COURS" },
      TERMINER: { from: ["EN_COURS"], to: "TERMINEE" },
      ANNULER: { from: ["PLANIFIEE", "EN_COURS"], to: "ANNULEE" },
    };
    const t = TRANSITIONS[body.action];
    if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (!t.from.includes(tournee.statut)) {
      return NextResponse.json({ error: `Impossible depuis le statut ${tournee.statut}` }, { status: 422 });
    }

    const userId = parseInt(session.user.id);
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.tourneeLivraison.update({
        where: { id: tourneeId },
        data: {
          statut: t.to as never,
          ...(body.action === "DEMARRER" && { heureDepart: now }),
          ...(body.action === "TERMINER" && { heureRetour: now }),
        },
        include: INCLUDE,
      });
      await auditLog(tx, userId, `TRN_${body.action}`, "TourneeLivraison", tourneeId, { avant: tournee.statut, apres: t.to }, getRequestMeta(req));
      return u;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/tournees/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
