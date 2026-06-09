import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/collaborateurs/[id]/plan-carriere
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const plan = await prisma.planCarriere.findUnique({ where: { profilRHId: Number(id) } });
    return NextResponse.json({ data: plan ?? null });
  } catch (error) {
    console.error("GET /api/admin/rh/collaborateurs/[id]/plan-carriere", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/rh/collaborateurs/[id]/plan-carriere
 * Upsert le plan de carrière.
 * Body: { aspiration?, prochainPosteVise?, dateRevision?, actions?, notes? }
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { aspiration, prochainPosteVise, dateRevision, actions, notes } = body;

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const plan = await prisma.planCarriere.upsert({
      where:  { profilRHId: Number(id) },
      create: {
        profilRHId:        Number(id),
        aspiration:        aspiration        ?? null,
        prochainPosteVise: prochainPosteVise ?? null,
        dateRevision:      dateRevision      ? new Date(dateRevision) : null,
        actions:           actions           ?? null,
        notes:             notes             ?? null,
      },
      update: {
        aspiration:        aspiration        ?? null,
        prochainPosteVise: prochainPosteVise ?? null,
        dateRevision:      dateRevision      ? new Date(dateRevision) : null,
        actions:           actions           ?? null,
        notes:             notes             ?? null,
      },
    });

    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("PUT /api/admin/rh/collaborateurs/[id]/plan-carriere", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
