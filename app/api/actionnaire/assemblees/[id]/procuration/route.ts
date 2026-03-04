import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/actionnaire/assemblees/[id]/procuration
 *
 * Body: { mandataireId: number, notes?: string }
 *
 * L'actionnaire connecté (mandant) donne procuration à un autre actionnaire (mandataire)
 * pour voter en son nom à l'assemblée.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);
    if (isNaN(assembleeId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json();
    const { mandataireId, notes } = body as { mandataireId: number; notes?: string };

    if (!mandataireId) {
      return NextResponse.json({ error: "mandataireId requis" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    // Vérifier que le mandant est bien un gestionnaire actionnaire
    const mandant = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
    });
    if (!mandant) {
      return NextResponse.json({ error: "Gestionnaire introuvable" }, { status: 404 });
    }

    // Vérifier que le mandataire existe
    const mandataire = await prisma.gestionnaire.findUnique({
      where: { id: mandataireId },
    });
    if (!mandataire) {
      return NextResponse.json({ error: "Mandataire introuvable" }, { status: 404 });
    }

    // Vérifier que l'assemblée existe et n'est pas terminée/annulée
    const assemblee = await prisma.assemblee.findUnique({
      where: { id: assembleeId },
    });
    if (!assemblee) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }
    if (assemblee.statut === "TERMINEE" || assemblee.statut === "ANNULEE") {
      return NextResponse.json(
        { error: "Impossible de donner procuration pour une assemblée terminée ou annulée" },
        { status: 400 }
      );
    }

    // Créer ou mettre à jour la procuration
    const procuration = await prisma.procurationAssemblee.upsert({
      where: {
        assembleeId_mandantId: {
          assembleeId,
          mandantId: mandant.id,
        },
      },
      create: {
        assembleeId,
        mandantId: mandant.id,
        mandataireId,
        notes: notes ?? null,
        statut: "EN_ATTENTE",
      },
      update: {
        mandataireId,
        notes: notes ?? null,
        statut: "EN_ATTENTE",
      },
    });

    return NextResponse.json({ data: procuration });
  } catch (error) {
    console.error("POST /api/actionnaire/assemblees/[id]/procuration", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * GET /api/actionnaire/assemblees/[id]/procuration
 * Retourne la procuration en cours pour cet utilisateur sur cette assemblée.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);
    const userId = parseInt(session.user.id);

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
    });
    if (!gestionnaire) {
      return NextResponse.json({ data: null });
    }

    const procuration = await prisma.procurationAssemblee.findUnique({
      where: {
        assembleeId_mandantId: {
          assembleeId,
          mandantId: gestionnaire.id,
        },
      },
      include: {
        mandataire: {
          include: {
            member: { select: { nom: true, prenom: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: procuration });
  } catch (error) {
    console.error("GET /api/actionnaire/assemblees/[id]/procuration", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/actionnaire/assemblees/[id]/procuration
 * Révoquer la procuration.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);
    const userId = parseInt(session.user.id);

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
    });
    if (!gestionnaire) {
      return NextResponse.json({ error: "Gestionnaire introuvable" }, { status: 404 });
    }

    await prisma.procurationAssemblee.update({
      where: {
        assembleeId_mandantId: {
          assembleeId,
          mandantId: gestionnaire.id,
        },
      },
      data: { statut: "REVOQUEE" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/actionnaire/assemblees/[id]/procuration", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
