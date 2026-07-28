import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { getOrCreateConversation } from "@/lib/messagerie";

/**
 * Messagerie instantanée — ouverte à tous les rôles (admin, gestionnaires, membres).
 * GET  — liste des conversations de l'utilisateur connecté, triées par dernier message,
 *        avec l'autre participant, l'aperçu du dernier message et le nombre de non-lus.
 * POST — démarre une conversation avec un destinataire (ou réutilise l'existante) et
 *        y envoie le premier message.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ utilisateurAId: userId }, { utilisateurBId: userId }] },
    orderBy: { dernierMessageAt: "desc" },
    include: {
      utilisateurA: { select: { id: true, nom: true, prenom: true, email: true, photo: true, role: true, gestionnaire: { select: { role: true, actif: true } } } },
      utilisateurB: { select: { id: true, nom: true, prenom: true, email: true, photo: true, role: true, gestionnaire: { select: { role: true, actif: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const data = await Promise.all(
    conversations.map(async (c) => {
      const autre = c.utilisateurAId === userId ? c.utilisateurB : c.utilisateurA;
      const nonLus = await prisma.messageChat.count({
        where: { conversationId: c.id, expediteurId: { not: userId }, lu: false },
      });
      return {
        id: c.id,
        autreParticipant: {
          id: autre.id, nom: autre.nom, prenom: autre.prenom, email: autre.email, photo: autre.photo,
          role: autre.role, gestionnaireRole: autre.gestionnaire?.actif ? autre.gestionnaire.role : null,
        },
        dernierMessage: c.messages[0]
          ? { contenu: c.messages[0].contenu, createdAt: c.messages[0].createdAt, expediteurId: c.messages[0].expediteurId }
          : null,
        dernierMessageAt: c.dernierMessageAt,
        nonLus,
      };
    })
  );

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);

  const body = await req.json().catch(() => null);
  const destinataireId = Number(body?.destinataireId);
  const contenu = typeof body?.contenu === "string" ? body.contenu.trim() : "";
  if (!destinataireId) return NextResponse.json({ message: "Destinataire requis" }, { status: 400 });
  if (destinataireId === userId) return NextResponse.json({ message: "Impossible de s'envoyer un message à soi-même" }, { status: 400 });
  if (!contenu) return NextResponse.json({ message: "Message vide" }, { status: 400 });

  const destinataire = await prisma.user.findUnique({ where: { id: destinataireId }, select: { id: true, nom: true, prenom: true, role: true } });
  if (!destinataire) return NextResponse.json({ message: "Destinataire introuvable" }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const conversation = await getOrCreateConversation(tx, userId, destinataireId);
    const message = await tx.messageChat.create({
      data: { conversationId: conversation.id, expediteurId: userId, contenu },
    });
    await tx.conversation.update({ where: { id: conversation.id }, data: { dernierMessageAt: message.createdAt } });

    const routeDestinataire = ["ADMIN", "SUPER_ADMIN"].includes(destinataire.role ?? "")
      ? "/dashboard/admin/messages" : "/dashboard/gestionnaire/messages";
    await notify(tx, [destinataireId], {
      titre: `${session.user.prenom ?? session.user.name ?? ""} vous a envoyé un message`,
      message: contenu.length > 120 ? `${contenu.slice(0, 120)}…` : contenu,
      actionUrl: `${routeDestinataire}?c=${conversation.id}`,
    });

    return { conversationId: conversation.id, message };
  });

  return NextResponse.json({ data: result });
}
