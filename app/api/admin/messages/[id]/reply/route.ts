import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/messages/[id]/reply
 * Le gestionnaire destinataire répond à un message de l'admin
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    const messageId = Number(id);
    const expediteurId = Number(session.user.id);

    const { contenu } = await req.json();
    if (!contenu?.trim()) {
      return NextResponse.json({ message: "Le contenu est obligatoire" }, { status: 400 });
    }

    // Récupérer le message original pour vérifier que c'est bien le destinataire qui répond
    const messageOriginal = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!messageOriginal) {
      return NextResponse.json({ message: "Message introuvable" }, { status: 404 });
    }

    if (messageOriginal.destinataireId !== expediteurId) {
      return NextResponse.json(
        { message: "Vous n'êtes pas le destinataire de ce message" },
        { status: 403 }
      );
    }

    const reponse = await prisma.$transaction(async (tx) => {
      const rep = await tx.message.create({
        data: {
          expediteurId,
          destinataireId: messageOriginal.expediteurId, // réponse → vers l'admin
          sujet:          `Re: ${messageOriginal.sujet}`,
          contenu:        contenu.trim(),
          parentId:       messageId,
        },
      });

      // Marquer le message original comme lu
      await tx.message.update({
        where: { id: messageId },
        data:  { lu: true, dateLecture: new Date() },
      });

      // Notifier l'admin dans sa cloche
      await tx.notification.create({
        data: {
          userId:    messageOriginal.expediteurId,
          titre:     `Réponse de ${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim(),
          message:   contenu.trim().length > 120
            ? contenu.trim().slice(0, 120) + "…"
            : contenu.trim(),
          priorite:  PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/messages`,
        },
      });

      return rep;
    });

    return NextResponse.json({ success: true, data: reponse }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/messages/[id]/reply:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
