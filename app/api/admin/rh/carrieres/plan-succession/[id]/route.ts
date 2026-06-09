import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  successeurs: {
    include: {
      profilRH: {
        select: {
          id: true, matricule: true, fonction: true, departement: true,
          gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        },
      },
    },
  },
};

/**
 * PATCH /api/admin/rh/carrieres/plan-succession/[id]
 * Modifier un poste critique.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { titre, departement, description, nbSuccesseursRequis, actif } = body;

    const existing = await prisma.posteCritique.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Poste critique introuvable" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (titre               !== undefined) data.titre               = titre;
    if (departement         !== undefined) data.departement         = departement         ?? null;
    if (description         !== undefined) data.description         = description         ?? null;
    if (nbSuccesseursRequis !== undefined) data.nbSuccesseursRequis = Number(nbSuccesseursRequis);
    if (actif               !== undefined) data.actif               = actif;

    const updated = await prisma.posteCritique.update({ where: { id: Number(id) }, data, include: INCLUDE });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/carrieres/plan-succession/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/carrieres/plan-succession/[id]
 * Supprimer un poste critique (cascade successeurs).
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.posteCritique.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Poste critique introuvable" }, { status: 404 });

    await prisma.posteCritique.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Poste critique supprimé" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/carrieres/plan-succession/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
