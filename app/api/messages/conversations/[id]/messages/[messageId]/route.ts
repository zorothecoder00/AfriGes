import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { estAutoriseMessagerie } from "@/lib/messagerie";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

/**
 * PATCH  — modifie le contenu d'un message (auteur uniquement, message non supprimé).
 * DELETE — suppression douce façon WhatsApp : contenu et pièce jointe effacés,
 *          le message reste dans le fil sous forme de placeholder (auteur uniquement).
 */
async function chargerMessage(conversationId: number, messageId: number, userId: number) {
  const message = await prisma.messageChat.findUnique({ where: { id: messageId } });
  if (!message || message.conversationId !== conversationId) return null;
  if (message.expediteurId !== userId) return "forbidden" as const;
  return message;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);
  if (!(await estAutoriseMessagerie(prisma, userId))) {
    return NextResponse.json({ message: "Messagerie réservée aux gestionnaires" }, { status: 403 });
  }

  const { id, messageId: messageIdRaw } = await params;
  const conversationId = Number(id);
  const messageId = Number(messageIdRaw);
  if (!conversationId || !messageId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const message = await chargerMessage(conversationId, messageId, userId);
  if (message === null) return NextResponse.json({ message: "Message introuvable" }, { status: 404 });
  if (message === "forbidden") return NextResponse.json({ message: "Vous ne pouvez modifier que vos propres messages" }, { status: 403 });
  if (message.supprime) return NextResponse.json({ message: "Ce message a été supprimé" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const contenu = typeof body?.contenu === "string" ? body.contenu.trim() : "";
  if (!contenu && !message.pieceJointeUrl) return NextResponse.json({ message: "Message vide" }, { status: 400 });

  const updated = await prisma.messageChat.update({
    where: { id: messageId },
    data: { contenu, modifie: true, modifieAt: new Date() },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);
  if (!(await estAutoriseMessagerie(prisma, userId))) {
    return NextResponse.json({ message: "Messagerie réservée aux gestionnaires" }, { status: 403 });
  }

  const { id, messageId: messageIdRaw } = await params;
  const conversationId = Number(id);
  const messageId = Number(messageIdRaw);
  if (!conversationId || !messageId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const message = await chargerMessage(conversationId, messageId, userId);
  if (message === null) return NextResponse.json({ message: "Message introuvable" }, { status: 404 });
  if (message === "forbidden") return NextResponse.json({ message: "Vous ne pouvez supprimer que vos propres messages" }, { status: 403 });
  if (message.supprime) return NextResponse.json({ data: message });

  const updated = await prisma.messageChat.update({
    where: { id: messageId },
    data: {
      contenu: "", supprime: true, supprimeAt: new Date(),
      pieceJointeUrl: null, pieceJointeNom: null, pieceJointeType: null, pieceJointeTaille: null,
    },
  });

  return NextResponse.json({ data: updated });
}
