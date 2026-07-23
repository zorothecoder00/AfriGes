import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";

/**
 * GET /api/collaborateur/planning
 * Retourne, pour le collaborateur connecté, ses affectations sur les plannings
 * d'équipe PUBLIÉS des 14 prochains jours (lecture seule, self-service).
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) return NextResponse.json({ profilRH: null, affectations: [] });

    const debut = new Date(); debut.setHours(0, 0, 0, 0);
    const fin   = new Date(debut); fin.setDate(fin.getDate() + 14);

    const affectations = await prisma.affectationPlanning.findMany({
      where: {
        profilRHId: profilRH.id,
        date:       { gte: debut, lte: fin },
        planning:   { statut: "PUBLIE" },
      },
      orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
      select: {
        id: true, date: true, heureDebut: true, heureFin: true, role: true, notes: true,
        planning: { select: { id: true, semaineDebut: true } },
      },
    });

    return NextResponse.json({ profilRH: { id: profilRH.id, matricule: profilRH.matricule }, affectations });
  } catch (error) {
    console.error("GET /api/collaborateur/planning", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
