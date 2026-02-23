import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { StatutDividende } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const dividendeId = parseInt(id);
    if (isNaN(dividendeId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const { periode, montantTotal, montantParPart, dateVersement, statut, notes } = await req.json();

    if (statut && !Object.values(StatutDividende).includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const dividende = await prisma.dividende.update({
      where: { id: dividendeId },
      data: {
        ...(periode && { periode }),
        ...(montantTotal !== undefined && { montantTotal: Number(montantTotal) }),
        ...(montantParPart !== undefined && { montantParPart: montantParPart ? Number(montantParPart) : null }),
        ...(dateVersement !== undefined && { dateVersement: dateVersement ? new Date(dateVersement) : null }),
        ...(statut && { statut }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ data: dividende });
  } catch (error) {
    console.error("PUT /api/admin/dividendes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const dividendeId = parseInt(id);
    if (isNaN(dividendeId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    await prisma.dividende.delete({ where: { id: dividendeId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/dividendes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
