import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { validerEvenement } from "@/lib/evenementMarketing";

/**
 * Événements marketing (CDC §42).
 * GET  — liste des événements.
 * POST — crée un événement.
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const evenements = await prisma.evenementMarketing.findMany({
      orderBy: { dateDebut: "desc" },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        _count: { select: { participants: true, soumissions: true } },
      },
    });

    const [presentsParEvt, leadsParEvt] = await Promise.all([
      prisma.participantEvenement.groupBy({ by: ["evenementId"], where: { statut: "PRESENT" }, _count: { _all: true } }),
      prisma.participantEvenement.groupBy({ by: ["evenementId"], where: { clientId: { not: null } }, _count: { _all: true } }),
    ]);
    const presentsMap = new Map(presentsParEvt.map((p) => [p.evenementId, p._count._all]));
    const leadsMap = new Map(leadsParEvt.map((l) => [l.evenementId, l._count._all]));

    return NextResponse.json({
      data: evenements.map((e) => ({
        ...e, budget: Number(e.budget), nbPresents: presentsMap.get(e.id) ?? 0, leadsGeneres: leadsMap.get(e.id) ?? 0,
      })),
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/evenements", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const valid = await validerEvenement(body);
    if ("error" in valid) return NextResponse.json({ error: valid.error }, { status: valid.status });

    const userId = Number(session.user.id);
    const evenement = await prisma.$transaction(async (tx) => {
      const e = await tx.evenementMarketing.create({ data: { ...valid.data, creeParId: userId } });
      await auditLog(tx, userId, "EVENEMENT_CREE", "EvenementMarketing", e.id);
      return e;
    });

    return NextResponse.json({ data: { ...evenement, budget: Number(evenement.budget) } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/evenements", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
