import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { SegmentClient } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/tags/[id]
 * Modifier un tag (nom, couleur, description, segment, actif).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const tagId = Number(id);
    if (isNaN(tagId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const existing = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!existing) return NextResponse.json({ error: "Tag introuvable" }, { status: 404 });

    const body = await req.json();
    const { nom, couleur, description, segment, actif } = body;

    // Vérifier doublon de nom si nom changé
    if (nom && nom.trim() !== existing.nom) {
      const duplicate = await prisma.tag.findUnique({ where: { nom: nom.trim() } });
      if (duplicate) {
        return NextResponse.json({ error: `Un tag "${nom.trim()}" existe déjà` }, { status: 409 });
      }
    }

    const updated = await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(nom         !== undefined && { nom: nom.trim() }),
        ...(couleur     !== undefined && { couleur }),
        ...(description !== undefined && { description: description || null }),
        ...(segment     !== undefined && { segment: segment ? (segment as SegmentClient) : null }),
        ...(actif       !== undefined && { actif: Boolean(actif) }),
      },
      include: { _count: { select: { clients: true } } },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/tags/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/tags/[id]
 * Supprimer un tag (et détache automatiquement tous les clients via CASCADE).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const tagId = Number(id);
    if (isNaN(tagId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const existing = await prisma.tag.findUnique({
      where: { id: tagId },
      include: { _count: { select: { clients: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Tag introuvable" }, { status: 404 });

    await prisma.tag.delete({ where: { id: tagId } });

    return NextResponse.json({ success: true, clientsAffectes: existing._count.clients });
  } catch (error) {
    console.error("DELETE /api/admin/tags/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
