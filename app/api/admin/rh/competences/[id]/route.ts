import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeCompetence } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/competences/[id]
 * Modifier une compétence du référentiel.
 * Body: { nom?, type?, categorie?, description?, actif? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { nom, type, categorie, description, actif } = body;

    const existing = await prisma.competence.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (nom         !== undefined) data.nom         = nom;
    if (type        !== undefined) data.type        = type as TypeCompetence;
    if (categorie   !== undefined) data.categorie   = categorie   ?? null;
    if (description !== undefined) data.description = description ?? null;
    if (actif       !== undefined) data.actif       = actif;

    const updated = await prisma.competence.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/competences/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/competences/[id]
 * Supprime si aucun collaborateur ne l'utilise, sinon désactive.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const comp = await prisma.competence.findUnique({
      where:   { id: Number(id) },
      include: { _count: { select: { collaborateurCompetences: true } } },
    });
    if (!comp) return NextResponse.json({ error: "Compétence introuvable" }, { status: 404 });

    if (comp._count.collaborateurCompetences > 0) {
      // Désactiver au lieu de supprimer
      await prisma.competence.update({ where: { id: Number(id) }, data: { actif: false } });
      return NextResponse.json({
        message: `Compétence désactivée (utilisée par ${comp._count.collaborateurCompetences} collaborateur(s))`,
        desactive: true,
      });
    }

    await prisma.competence.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Compétence supprimée" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/competences/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
