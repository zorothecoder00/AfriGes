import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrioriteNotification, Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, nom: true, prenom: true, email: true },
    });

    // Notifier les admins seulement si le compte existe
    if (user) {
      const admins = await prisma.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Demande de réinitialisation de mot de passe",
            message: `${user.prenom} ${user.nom} (${user.email}) a demandé la réinitialisation de son mot de passe.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: "/dashboard/admin/membres",
          })),
          skipDuplicates: true,
        });
      }
    }

    // Toujours renvoyer succès pour ne pas révéler si l'email existe
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/forgot-password", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
