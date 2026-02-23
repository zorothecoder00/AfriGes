import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";
import { DecisionVote } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const resolutionId = parseInt(id);
    if (isNaN(resolutionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const { decision, commentaire } = await req.json();

    if (!decision || !Object.values(DecisionVote).includes(decision)) {
      return NextResponse.json({ error: "Décision invalide (POUR, CONTRE, ABSTENTION)" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
    });
    if (!gestionnaire) {
      return NextResponse.json({ error: "Profil gestionnaire introuvable" }, { status: 404 });
    }

    const resolution = await prisma.resolutionAssemblee.findUnique({
      where: { id: resolutionId },
      include: { assemblee: true },
    });
    if (!resolution) {
      return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });
    }
    if (resolution.assemblee.statut === "TERMINEE" || resolution.assemblee.statut === "ANNULEE") {
      return NextResponse.json({ error: "L'assemblée est terminée ou annulée" }, { status: 400 });
    }

    // Vérifier que l'actionnaire est bien participant
    const participant = await prisma.assembleeParticipant.findUnique({
      where: {
        assembleeId_gestionnaireId: {
          assembleeId: resolution.assembleeId,
          gestionnaireId: gestionnaire.id,
        },
      },
    });
    if (!participant) {
      return NextResponse.json({ error: "Vous n'êtes pas invité à cette assemblée" }, { status: 403 });
    }

    const vote = await prisma.voteAssemblee.upsert({
      where: {
        resolutionId_participantId: {
          resolutionId,
          participantId: participant.id,
        },
      },
      update: { decision, commentaire: commentaire ?? null },
      create: {
        resolutionId,
        participantId: participant.id,
        decision,
        commentaire: commentaire ?? null,
      },
    });

    return NextResponse.json({ data: vote });
  } catch (error) {
    console.error("POST /api/actionnaire/resolutions/[id]/voter", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
