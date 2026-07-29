import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { estAutoriseMessagerie } from "@/lib/messagerie";

/** GET /api/messages/unread-count — total des messages non lus, toutes conversations confondues. */
export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
  const userId = Number(session.user.id);
  if (!(await estAutoriseMessagerie(prisma, userId))) {
    return NextResponse.json({ nonLus: 0 });
  }

  const nonLus = await prisma.messageChat.count({
    where: {
      lu: false,
      expediteurId: { not: userId },
      conversation: { OR: [{ utilisateurAId: userId }, { utilisateurBId: userId }] },
    },
  });

  return NextResponse.json({ nonLus });
}
