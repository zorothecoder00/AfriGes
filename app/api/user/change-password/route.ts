import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId = parseInt(session.user.id);
    const { currentPassword, newPassword } = await req.json() as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Aucun mot de passe défini pour ce compte" }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 }, // invalide l'ancien JWT → force re-login
      },
    });

    return NextResponse.json({ success: true, message: "Mot de passe changé avec succès" });
  } catch (error) {
    console.error("PATCH /api/user/change-password", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
