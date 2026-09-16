import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { statsAchatsRevendeur } from "@/lib/revendeur";

/** GET /api/revendeur/profil — "Carte professionnelle" + "État des achats" du revendeur connecté. */
export async function GET() {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const profil = await prisma.profilRevendeur.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
        pointDeVente: { select: { id: true, nom: true, code: true, adresse: true } },
      },
    });
    if (!profil) return NextResponse.json({ error: "Aucun compte revendeur ouvert pour cet utilisateur" }, { status: 404 });

    const stats = await statsAchatsRevendeur(userId);
    return NextResponse.json({ data: profil, stats });
  } catch (error) {
    console.error("GET /revendeur/profil:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
