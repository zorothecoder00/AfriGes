import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { StatutPlanActionCommRIA, PrioriteActionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { statut, titre, description, priorite, responsableId, dateDebut, dateEcheance, progression, notes } = body;

    const data: Record<string, unknown> = {};
    if (titre       !== undefined) data.titre       = titre;
    if (description !== undefined) data.description = description;
    if (priorite    !== undefined) data.priorite    = priorite as PrioriteActionRIA;
    if (statut      !== undefined) {
      data.statut = statut as StatutPlanActionCommRIA;
      if (statut === "TERMINE") data.dateTermine = new Date();
    }
    if (responsableId !== undefined) data.responsableId = responsableId ? Number(responsableId) : null;
    if (dateDebut     !== undefined) data.dateDebut     = dateDebut ? new Date(dateDebut) : null;
    if (dateEcheance  !== undefined) data.dateEcheance  = dateEcheance ? new Date(dateEcheance) : null;
    if (progression   !== undefined) data.progression   = Math.min(100, Math.max(0, Number(progression)));
    if (notes         !== undefined) data.notes         = notes;

    const plan = await prisma.planActionCommRIA.update({
      where: { id: parseInt(id) },
      data,
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        resolution: { select: { id: true, numero: true, titre: true } },
      },
    });

    return NextResponse.json(plan);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    await prisma.planActionCommRIA.delete({ where: { id: parseInt(id) } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
