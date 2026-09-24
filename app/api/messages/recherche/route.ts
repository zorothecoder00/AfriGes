import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { estAutoriseMessagerie } from "@/lib/messagerie";

/**
 * GET ?q=<texte> — recherche plein texte dans les messages des conversations de
 * l'utilisateur connecté (insensible à la casse, messages supprimés exclus).
 * Renvoie les 30 plus récents avec l'autre participant, pour ouvrir le fil sur le message.
 */
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);
  if (!(await estAutoriseMessagerie(prisma, userId))) {
    return NextResponse.json({ message: "Messagerie réservée aux gestionnaires" }, { status: 403 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ data: [] });

  const personne = { select: { id: true, nom: true, prenom: true, email: true, photo: true, role: true, gestionnaire: { select: { role: true, actif: true } } } };
  const messages = await prisma.messageChat.findMany({
    where: {
      supprime: false,
      contenu: { contains: q, mode: "insensitive" },
      conversation: { OR: [{ utilisateurAId: userId }, { utilisateurBId: userId }] },
    },
    orderBy: { id: "desc" },
    take: 30,
    select: {
      id: true, conversationId: true, expediteurId: true, contenu: true, createdAt: true,
      conversation: { select: { utilisateurAId: true, utilisateurA: personne, utilisateurB: personne } },
    },
  });

  const data = messages.map((m) => {
    const autre = m.conversation.utilisateurAId === userId ? m.conversation.utilisateurB : m.conversation.utilisateurA;
    return {
      id: m.id, conversationId: m.conversationId, expediteurId: m.expediteurId, contenu: m.contenu, createdAt: m.createdAt,
      autreParticipant: {
        id: autre.id, nom: autre.nom, prenom: autre.prenom, email: autre.email, photo: autre.photo,
        role: autre.role, gestionnaireRole: autre.gestionnaire?.actif ? autre.gestionnaire.role : null,
      },
    };
  });

  return NextResponse.json({ data });
}
