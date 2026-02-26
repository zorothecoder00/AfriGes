import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/gestionnaire/messages
 * Messages reçus par le gestionnaire connecté (envoyés par l'admin), avec leurs réponses
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const userId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  ?? 1));
    const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
    const skip  = (page - 1) * limit;

    const [messages, total, nonLus] = await Promise.all([
      prisma.message.findMany({
        where: { destinataireId: userId, parentId: null },
        include: {
          expediteur: {
            select: { id: true, nom: true, prenom: true, email: true },
          },
          reponses: {
            orderBy: { createdAt: "asc" },
            include: {
              expediteur: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { destinataireId: userId, parentId: null } }),
      prisma.message.count({ where: { destinataireId: userId, lu: false, parentId: null } }),
    ]);

    // Marquer tous les messages récupérés comme lus
    await prisma.message.updateMany({
      where: { destinataireId: userId, lu: false, parentId: null },
      data:  { lu: true, dateLecture: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), nonLus },
    });
  } catch (error) {
    console.error("GET /api/gestionnaire/messages:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
