import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/rvc/ria/eligibilite/[id]
 * action: VALIDER (ELIGIBLE → VALIDE) | RETIRER (→ RETIRE) | REOUVRIR (RETIRE → statut auto)
 * Le RVC confirme l'identification du client comme finançable par le RIA.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, notes } = await req.json();

    const elig = await prisma.eligibiliteClientRIA.findUnique({ where: { id: parseInt(id) } });
    if (!elig) return NextResponse.json({ error: "Éligibilité introuvable" }, { status: 404 });

    if (action === "VALIDER") {
      if (elig.statut !== "ELIGIBLE") {
        return NextResponse.json({ error: "Seul un client ÉLIGIBLE peut être confirmé" }, { status: 400 });
      }
      const updated = await prisma.eligibiliteClientRIA.update({
        where: { id: elig.id },
        data: { statut: "VALIDE", decisionAuto: false, identifieParId: parseInt(session.user.id), dateDecision: new Date(), notes: notes ?? elig.notes },
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "RETIRER") {
      const updated = await prisma.eligibiliteClientRIA.update({
        where: { id: elig.id },
        data: { statut: "RETIRE", notes: notes ?? elig.notes },
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "action doit être VALIDER ou RETIRER" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/rvc/ria/eligibilite/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
