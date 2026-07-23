import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/rh/planning/[id]/affectations
 * Ajoute une ligne d'affectation à un planning d'équipe.
 * Body: { profilRHId, date, heureDebut, heureFin, role?, notes? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const planning = await prisma.planningEquipe.findUnique({ where: { id: Number(id) } });
    if (!planning) return NextResponse.json({ error: "Planning introuvable" }, { status: 404 });

    const body = await req.json();
    const { profilRHId, date, heureDebut, heureFin, role, notes } = body;

    if (!profilRHId || !date || !heureDebut || !heureFin) {
      return NextResponse.json({ error: "profilRHId, date, heureDebut et heureFin sont obligatoires" }, { status: 400 });
    }

    const affectation = await prisma.affectationPlanning.create({
      data: {
        planningId: Number(id),
        profilRHId: Number(profilRHId),
        date:       new Date(date),
        heureDebut: String(heureDebut),
        heureFin:   String(heureFin),
        role:       role ?? null,
        notes:      notes ?? null,
      },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "AffectationPlanning", entiteId: affectation.id,
        details: `Affectation ajoutée au planning #${id}` },
    });

    return NextResponse.json({ data: affectation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/planning/[id]/affectations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
