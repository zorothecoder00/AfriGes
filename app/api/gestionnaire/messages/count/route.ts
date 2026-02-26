import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/gestionnaire/messages/count
 * Retourne uniquement le nombre de messages non lus pour le gestionnaire connecté.
 * N'effectue aucun marquage comme lu.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ nonLus: 0 });

    const userId = Number(session.user.id);

    const nonLus = await prisma.message.count({
      where: { destinataireId: userId, lu: false, parentId: null },
    });

    return NextResponse.json({ nonLus });
  } catch {
    return NextResponse.json({ nonLus: 0 });
  }
}
