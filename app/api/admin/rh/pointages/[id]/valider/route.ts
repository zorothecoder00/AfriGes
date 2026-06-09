import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/rh/pointages/[id]/valider
 * Valide (ou invalide) un pointage.
 * Body: { valider: boolean }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { valider } = await req.json();

    const existing = await prisma.pointage.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Pointage introuvable" }, { status: 404 });

    const updated = await prisma.pointage.update({
      where: { id: Number(id) },
      data: {
        valideParId: valider ? parseInt(session.user.id) : null,
        valideA:     valider ? new Date()                : null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /api/admin/rh/pointages/[id]/valider", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
