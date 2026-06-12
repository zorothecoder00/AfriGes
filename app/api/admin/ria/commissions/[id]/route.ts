import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { action, notes } = body as { action: string; notes?: string };

    const commission = await prisma.commissionAgentRIA.findUnique({ where: { id: parseInt(id) } });
    if (!commission) return NextResponse.json({ error: "Commission introuvable" }, { status: 404 });

    let data: Record<string, unknown> = {};

    switch (action) {
      case "APPROUVER":
        if (commission.statut !== "CALCULE") {
          return NextResponse.json({ error: "Seules les commissions CALCULÉES peuvent être approuvées" }, { status: 400 });
        }
        data = { statut: "APPROUVE", approuveParId: session.user.id, dateApprobation: new Date(), notes: notes ?? commission.notes };
        break;

      case "MARQUER_PAYE":
        if (commission.statut !== "APPROUVE") {
          return NextResponse.json({ error: "Seules les commissions APPROUVÉES peuvent être marquées payées" }, { status: 400 });
        }
        data = { statut: "PAYE", datePaiement: new Date(), notes: notes ?? commission.notes };
        break;

      case "ANNULER":
        if (commission.statut === "PAYE") {
          return NextResponse.json({ error: "Une commission déjà payée ne peut pas être annulée" }, { status: 400 });
        }
        data = { statut: "ANNULE", notes: notes ?? commission.notes };
        break;

      case "RECALCULER":
        if (commission.statut !== "CALCULE") {
          return NextResponse.json({ error: "Seules les commissions CALCULÉES peuvent être recalculées" }, { status: 400 });
        }
        // Force-reset to recalculate from scratch
        data = { statut: "CALCULE", notes: notes ?? commission.notes };
        break;

      default:
        return NextResponse.json({ error: "Action inconnue : APPROUVER | MARQUER_PAYE | ANNULER | RECALCULER" }, { status: 400 });
    }

    const updated = await prisma.commissionAgentRIA.update({
      where: { id: parseInt(id) },
      data,
      include: {
        user:        { select: { id: true, nom: true, prenom: true } },
        approuvePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
