import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { PrioriteNotification } from "@prisma/client";

/**
 * GET /api/admin/messages
 * Messages envoyés par l'admin (+ leurs réponses imbriquées)
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const adminId = Number(session.user.id);
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  ?? 1));
    const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
    const skip  = (page - 1) * limit;

    const [messages, total, nonLus] = await Promise.all([
      prisma.message.findMany({
        where: { expediteurId: adminId, parentId: null },
        include: {
          destinataire: {
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
      prisma.message.count({ where: { expediteurId: adminId, parentId: null } }),
      prisma.message.count({ where: { destinataireId: adminId, lu: false } }),
    ]);

    return NextResponse.json({
      success: true,
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), nonLus },
    });
  } catch (error) {
    console.error("GET /api/admin/messages:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/messages
 * L'admin envoie un message à un gestionnaire précis
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const adminId = Number(session.user.id);
    const { destinataireId, sujet, contenu } = await req.json();

    if (!destinataireId || !sujet?.trim() || !contenu?.trim()) {
      return NextResponse.json(
        { message: "destinataireId, sujet et contenu sont obligatoires" },
        { status: 400 }
      );
    }

    // Vérifier que le destinataire est un gestionnaire actif
    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { memberId: Number(destinataireId), actif: true },
      include: { member: { select: { id: true, nom: true, prenom: true } } },
    });

    if (!gestionnaire) {
      return NextResponse.json(
        { message: "Gestionnaire introuvable ou inactif" },
        { status: 404 }
      );
    }

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          expediteurId:   adminId,
          destinataireId: Number(destinataireId),
          sujet:          sujet.trim(),
          contenu:        contenu.trim(),
        },
      });

      // Notifier le gestionnaire dans sa cloche
      await tx.notification.create({
        data: {
          userId:    Number(destinataireId),
          titre:     `Message de l'admin : ${sujet.trim()}`,
          message:   contenu.trim().length > 120
            ? contenu.trim().slice(0, 120) + "…"
            : contenu.trim(),
          priorite:  PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/gestionnaire/messages`,
        },
      });

      return msg;
    });

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/messages:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
