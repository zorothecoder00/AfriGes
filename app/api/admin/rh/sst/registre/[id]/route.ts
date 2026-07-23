import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/sst/registre/[id]
 * Édition seule (journal légal — pas de suppression).
 * Body: { description?, lieu?, actionsPrises?, documentUrl?, notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.registreSST.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Entrée introuvable" }, { status: 404 });

    const body = await req.json();
    const allowed = ["description", "lieu", "actionsPrises", "documentUrl", "notes"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key] ?? null;
    }

    const updated = await prisma.registreSST.update({ where: { id: Number(id) }, data });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "RegistreSST", entiteId: Number(id), details: `Entrée SST #${id} modifiée` },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/sst/registre/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
