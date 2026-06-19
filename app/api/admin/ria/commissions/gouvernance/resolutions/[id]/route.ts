import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import {
  RESOLUTION_TRANSITIONS, RESOLUTION_PRECONDITIONS, type ResolutionAction,
} from "@/lib/commissionsRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const resolution = await prisma.resolutionCommRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        reunion: { select: { id: true, titre: true, dateHeure: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: {
          include: {
            responsable: { select: { id: true, nom: true, prenom: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!resolution) return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });
    return NextResponse.json(resolution);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const resolutionId = parseInt(id);
    const body = await req.json();
    const { action, titre, description, dateEcheance, responsableId } = body as {
      action?: ResolutionAction; titre?: string; description?: string;
      dateEcheance?: string | null; responsableId?: number | null;
    };

    const data: Record<string, unknown> = {};
    if (titre !== undefined) data.titre = titre;
    if (description !== undefined) data.description = description;
    if (dateEcheance !== undefined) data.dateEcheance = dateEcheance ? new Date(dateEcheance) : null;
    if (responsableId !== undefined) data.responsableId = responsableId ? Number(responsableId) : null;

    // Workflow de vote (CDC) : EN_PREPARATION → SOUMISE → ADOPTEE|REJETEE → EXECUTEE.
    // L'admin supervise (pas de contrôle « est Président ») mais respecte l'ordre des transitions.
    if (action) {
      const allowed = RESOLUTION_PRECONDITIONS[action];
      if (!allowed) return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
      const existante = await prisma.resolutionCommRIA.findUnique({
        where: { id: resolutionId }, select: { statut: true },
      });
      if (!existante) return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });
      if (!allowed.includes(existante.statut as never)) {
        return NextResponse.json({ error: `Action « ${action} » impossible depuis le statut « ${existante.statut} »` }, { status: 409 });
      }
      data.statut = RESOLUTION_TRANSITIONS[action];
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
    }

    const resolution = await prisma.resolutionCommRIA.update({
      where: { id: resolutionId },
      data,
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        plansAction: true,
      },
    });

    return NextResponse.json(resolution);
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
    // Les plans d'action liés voient leur resolutionId mis à null (relation optionnelle).
    await prisma.resolutionCommRIA.delete({ where: { id: parseInt(id) } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
