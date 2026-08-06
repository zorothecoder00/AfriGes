import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/marketing/taches/[id] — { statut: "A_FAIRE" | "TERMINEE" } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const tacheId = Number(id);
    if (isNaN(tacheId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { statut } = await req.json();
    if (!["A_FAIRE", "TERMINEE"].includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const tache = await prisma.tacheMarketing.update({ where: { id: tacheId }, data: { statut } });
    return NextResponse.json({ data: tache });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/taches/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
