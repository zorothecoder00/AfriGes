import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notify } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET  — messages d'une conversation (50 derniers, plus anciens via ?before=<messageId>),
 *        marque comme lus les messages reçus par l'appelant.
 * POST — envoie un message dans une conversation existante.
 * Accès : réservé aux deux participants de la conversation.
 */
async function verifierParticipant(conversationId: number, userId: number) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return null;
  if (conversation.utilisateurAId !== userId && conversation.utilisateurBId !== userId) return null;
  return conversation;
}

export async function GET(req: Request, { params }: Ctx) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);

  const conversationId = Number((await params).id);
  if (!conversationId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const conversation = await verifierParticipant(conversationId, userId);
  if (!conversation) return NextResponse.json({ message: "Conversation introuvable" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");

  const messages = await prisma.messageChat.findMany({
    where: { conversationId, ...(before ? { id: { lt: Number(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  await prisma.messageChat.updateMany({
    where: { conversationId, expediteurId: { not: userId }, lu: false },
    data: { lu: true, dateLecture: new Date() },
  });

  return NextResponse.json({ data: messages.reverse() });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);

  const conversationId = Number((await params).id);
  if (!conversationId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const conversation = await verifierParticipant(conversationId, userId);
  if (!conversation) return NextResponse.json({ message: "Conversation introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const contenu = typeof body?.contenu === "string" ? body.contenu.trim() : "";
  if (!contenu) return NextResponse.json({ message: "Message vide" }, { status: 400 });

  const destinataireId = conversation.utilisateurAId === userId ? conversation.utilisateurBId : conversation.utilisateurAId;
  const destinataire = await prisma.user.findUnique({ where: { id: destinataireId }, select: { role: true } });

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.messageChat.create({ data: { conversationId, expediteurId: userId, contenu } });
    await tx.conversation.update({ where: { id: conversationId }, data: { dernierMessageAt: created.createdAt } });

    const routeDestinataire = ["ADMIN", "SUPER_ADMIN"].includes(destinataire?.role ?? "")
      ? "/dashboard/admin/messages" : "/dashboard/gestionnaire/messages";
    await notify(tx, [destinataireId], {
      titre: `${session.user.prenom ?? session.user.name ?? ""} vous a envoyé un message`,
      message: contenu.length > 120 ? `${contenu.slice(0, 120)}…` : contenu,
      actionUrl: `${routeDestinataire}?c=${conversationId}`,
    });

    return created;
  });

  return NextResponse.json({ data: message });
}
